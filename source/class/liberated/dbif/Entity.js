/**
 * Copyright (c) 2011 Derrell Lipman
 * Copyright (c) 2011 Reed Spool
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

/**
 * The abstract base class from which all concrete entities descend.
 */
qx.Class.define("liberated.dbif.Entity",
{
  extend : qx.core.Object,
  type   : "abstract",
  
  /**
   * Constructor for an Entity.
   *
   * @param entityType {String}
   *   The name of this type of entity. It is used during normal operation to
   *   retrieve the property types available for this entity.
   *
   * @param entityKey {String|Integer|Array}
   *   If the entity key is a single field, this must be a string or integer
   *   specifying that key value. If the entity key is composite, i.e., it is
   *   made up of a series of fields, then this must be an array containing
   *   the string or integer values of each of the fields in the key.
   */
  construct : function(entityType, entityKey)
  {
    var             i;
    var             name;
    var             queryResults;
    var             keyField;
    var             cloneObj;
    var             properties;
    var             entityData;
    var             bComposite;
    var             query;
    var             field;
    var             propertyType;
    var             propertyTypes;
    var             canonProps;
    var             nonCanonKeyField = null;
    var             nonCanonKey;

    // Call the superclass constructor
    this.base(arguments);
    
    // Save the entity type
    this.setEntityType(entityType);
    
    // Gain easy access to the property type definition for this entity type
    propertyTypes = liberated.dbif.Entity.propertyTypes[entityType];
    
    // Get the key field name.
    keyField = this.getEntityKeyProperty();
    
    // Determine whether we have a composite key
    bComposite = (qx.lang.Type.getClass(keyField) === "Array");

    // Retrieve any pre-set entity data
    entityData = this.getData();

    // Was there any pre-set entity data?
    if (! entityData)
    {
      // Nope. Initialize it.
      entityData = {};
      this.setData(entityData);
    }

    // Determine if the key field is autogenerated by canonicalization
    canonProps = propertyTypes.canonicalize;
    if (canonProps)
    {
      for (name in canonProps)
      {
        // Is this canonical property name our key field?
        if (canonProps[name].prop == keyField)
        {
          // Yes. Save the non-canonicalized field name
          nonCanonKeyField = name;

          // Save the original (non-canonicalized) key value
          nonCanonKey = entityKey;

          // Canonicalize the entity key
          entityKey = canonProps[name].func(entityKey);

          // No need to search farther
          break;
        }
      }
    }

    // If an entity key was specified...
    if (typeof entityKey != "undefined" && entityKey !== null)
    {
      // ... then query for the object.
      queryResults = 
        liberated.dbif.Entity.query(this.constructor.classname, entityKey);
      
      // Did we find anything there?
      if (queryResults.length == 0)
      {
        // Nope. Just set this object's key. Is it composite?
        if (bComposite)
        {
          // Yup. Set each of the fields
          for (i = 0; i < keyField.length; i++)
          {
            entityData[keyField[i]] = entityKey[i];
          }
        }
        else
        {
          // Not composite, so just assign the key to the single field
          entityData[keyField] = entityKey;
          
          // If this key field is canonicalized...
          if (nonCanonKeyField)
          {
            // ... then save the original value too
            entityData[nonCanonKeyField] = nonCanonKey;
          }
        }
      }
      else
      {
        // Set our object data to the data retrieved from the query
        entityData = queryResults[0];
        this.setData(entityData);
        
        // It's not a brand new object
        this.setBrandNew(false);
      }
    }
    
    // Fill in any missing properties
    for (propertyType in propertyTypes.fields)
    {
      // If this property type is not represented in the entity data...
      if (typeof(entityData[propertyType]) == "undefined")
      {
        // ... then add it, with a null value.
        entityData[propertyType] = null;
      }
    }
    
    // If we're in debugging mode...
    if (qx.core.Environment.get("qx.debug"))
    {
      // ... then ensure that there are no properties that don't belong
      for (propertyType in entityData)
      {
        if (! (propertyType in
               liberated.dbif.Entity.propertyTypes[entityType].fields))
        {
          throw new Error("Unrecognized property (" + propertyType + ")" +
                          " in entity data for type " + entityType + ".");
        }
      }
    }
  },

  properties :
  {
    /** A map containing the data for this entity */
    data :
    {
      init : null,
      check : "Object"
    },

    /** Flag indicating that this entity was newly created */
    brandNew :
    {
      init  : true,
      check : "Boolean"
    },

    /**
     * The property name that is to be used as the database entity key (aka
     * primary key). If the key is composite, i.e., composed of more than one
     * property, than this contains an array of strings, where each string is
     * the name of a property, and the key is composed of the fields from each
     * of these properties, in the order listed herein.
     */
    entityKeyProperty :
    {
      init  : "uid",
      check : "qx.lang.Type.isString(value) || qx.lang.Type.isArray(value)"
    },

    /** Mapping from classname to type used in the database */
    entityType :
    {
      check    : "String",
      nullable : false
    },

    /**
     * The unique id to be used as the database entity key (aka primary key),
     * if no other property has been designated in entityKeyProperty as the
     * primary key. The actual value is determined by the specific database
     * interface in use, so this may be either an integer or a string.
     */
    uid :
    {
      init : null
    }
  },
  
  statics :
  {
    /** Transaction identifier */
    __transaction : null,

    /** Maximum number of times to try a transaction before failing */
    MAX_COMMIT_TRIES : 5,

    /** Whether to strip the canonocalized fields from query results */
    DEFAULT_STRIP_CANON : false, // Leave this false. true breaks things.


    /** Map from classname to entity type */
    entityTypeMap : {},


    /** Assignment of property types for each entity class */
    propertyTypes : {},


    /**
     * Register an entity type. This is called by each subclass, immediately
     * upon loading the subclass (typically in its defer: function), in order
     * to register that subclass' entity type name to correspond with that
     * subclass' class name.
     *
     * Each subclass of liberated.dbif.Entity represents a particular object
     * type, and is identified by its class name and by its (shorter)
     * entityType.
     *
     * @param classname {String}
     *   The class name of the concrete subclass of liberated.dbif.Entity being
     *   registered.
     *
     * @param entityType {String}
     *   The short entity type name of the subclass being registered.
     */
    registerEntityType : function(classname, entityType)
    {
      // Save this value in the map from classname to entity type
      liberated.dbif.Entity.entityTypeMap[classname] = entityType;
    },


    /**
     * Retrieve the property types for a given entity type
     *
     * @return {Map}
     *   A map, where the key fields are class names, and the values are the
     *   shorter entity type names
     */
    getEntityTypes : function()
    {
      // Make a deep copy of the results
      return qx.util.Serializer.toNativeObject( 
        liberated.dbif.Entity.entityTypeMap);
    },


    /**
     * Register the property types for an entity class. This is called by each
     * subclass, immediately upon loading the subclass (typically in its
     * defer: function), in order to register the names of the properties
     * (fields) that are stored for each object of this type.
     *
     * @param entityType {String}
     *   The entity type name (as was passed to registerEntityType()), which
     *   uniquely identifies this subclass of liberated.dbif.Entity.
     *
     * @param propertyTypes {Map}
     *   A map containing, as its member names, the name of each of the
     *   properties (fields) to be stored for each object of this type. The
     *   value corresponding to each of those member names is the type of
     *   value to be stored in that property, and may be any of: "String",
     *   "LongString", "Date", "Key", "Integer", "Float", "KeyArray",
     *   "StringArray", "LongStringArray", or "NumberArray".
     *
     * @param keyField {String|Array}
     *   The name of the property that is to be used as the key field. If the
     *   key is composite, i.e., composed of more than one property, than this
     *   contains an array of strings, where each string is the name of a
     *   property, and the key is composed of the fields from each of these
     *   properties, in the order listed herein.
     *
     * @param canonicalize {Map?}
     *   A map describing fields that are to be canonicalized, and the
     *   canonicalization function. The map contains one or more members. Each
     *   member name is a property name defined in the propertyTypes map. The
     *   associated member value is itself a map, consisting of three members:
     *   prop, which defines a new property in which the canonical value is to
     *   be stored; type, the type of the canonical property (see the
     *   propertyTypes parameter); and func, which is the canonicalization
     *   function. The canonicalization function takes one parameter, the
     *   value to be canonicalized, and returns the canonical value.
     *
     *   When a canonicalized field is provided, all query criteria
     *   referencing the original field are modified to search using the
     *   canonicalized field in its stead. The criterium is modified by
     *   converting the search value using the canonicalization function, and
     *   using the canonicalized property instead of the original property.
     *
     *   Here is an example canonicalize map. This one uses the "value"
     *   property (previously defined in propertyTypes}, and adds a
     *   canonicalized value in a field called "value_lc". The canonicalized
     *   value is created by converting the "value" field to lower case.
     *     {
     *       "value" :
     *       {
     *         // Property in which to store the canonicalized value. Since we
     *         // are converting the value to lower case, we'll give the
     *         // property a name suffix that reflects that.
     *         prop : "value_lc",
     *
     *         // The canonicalized value will be a string
     *         type : "String",
     *
     *         // Function to convert a value to lower case
     *         func : function(value)
     *         {
     *           return value.toLowerCase();
     *         }
     *       }
     *     };
     *
     *   Note that if the property being canonicalized is an array, the
     *   specified function is called once for each member of the array, so
     *   the resulting canonical value will also be an array, containing
     *   individually-canonicalized values.
     */
    registerPropertyTypes : function(entityType, 
                                     propertyTypes,
                                     keyField,
                                     canonicalize)
    {
      var             pn;       // property name

      // If there's no key field name specified...
      if (! keyField)
      {
        // Add "uid" to the list of database properties.
        propertyTypes["uid"] = "Key";
        keyField = "uid";
      }

      // Add the canonicalize properties to the property list
      if (canonicalize)
      {
        for (pn in canonicalize)
        {
          // Add the property in which to store the canonicalized value 
          // to the list of database properties.
          propertyTypes[canonicalize[pn].prop] = canonicalize[pn].type;
        }
      }

      liberated.dbif.Entity.propertyTypes[entityType] = 
        {
          keyField      : keyField,
          fields        : propertyTypes,
          canonicalize  : canonicalize
        };
    },

    /**
     * Retrieve the property types for a given entity type
     *
     * @param entityType {String}
     *   The type of entity whose properties are being requested.
     *
     * @return {Map}
     *   A map containing fields: keyField (Number, String or Array), fields
     *   (Map), and canonicalize (Function).
     */
    getPropertyTypes : function(entityType)
    {
      // Make a deep copy of the results
      return qx.util.Serializer.toNativeObject(
        liberated.dbif.Entity.propertyTypes[entityType]);
    },

    /**
     * Function to query for objects.
     *
     * @param classname {String}
     *   The name of the class, descended from liberated.dbif.Entity, of
     *   the object type which is to be queried in the database.
     *
     * @param searchCriteria {Map?}
     *   A (possibly recursive) map which contains the following members:
     *     type {String}
     *       "op" -- a logical operation. In this case, there must also be a
     *               "method" member which contains the logical operation to
     *               be performed. Currently, the only supported operation
     *               at present is  "and". There must also be a "children"
     *               member, which is an array of the critieria to which the
     *               specified operation is applied.
     *
     *       "element" -- Search by specific field in the object. The
     *                    "field" member must be provided, to specify which
     *                    field, and a "value" member must be specified, to
     *                    indicate what value must be in that field.
     *
     *                    An optional "filterOp" member may also be
     *                    provided. If none is provided, the requested
     *                    operation is assumed to be equality. Any of the
     *                    following values may be provided for the "filterOp"
     *                    member: "<", "<=", "=", ">", ">=", "!=".
     *
     *   If no criteria is supplied (undefined or null), then all objects of
     *   the specified classname will be returned.
     *
     * @param resultCriteria {Array?}
     *   An array of maps. Each map contains 2 or more members: a "type" and one
     *   or more type dependent members. The type "offset" necessitates a member
     *   "value" with an integer value specifying how many initial objects to
     *   skip from the result objects. The offset must be non-negative. The type
     *   "limit" also requires a member "value" whose integer value is the total
     *   number of result objects to return. The limit must be greater than 
     *   zero. When the type is "sort", two members must be present:
     *   "field" and "order". The "field" is a string specifying the result
     *   object member on which to sort. The "order" is also a string, either 
     *   "asc" or "desc".
     *
     *   There may be zero or one of the maps of type "limit" or "offset". Of
     *   the maps of type "sort", there may be any number, and their order in
     *   the array is the order the sort is applied on each field. 
     *
     *   A final "type" is called "option", in which case there must be a
     *   "name" field to specify which option is being set, and a "value"
     *   field which is of the correct type for the specified name. The
     *   possible option names and values types are:
     *
     *     stripCanon : boolean 
     * *     (default liberated.dbif.Entity.DEFAULT_STRIP_CANON)
     *     
     *
     *   An example resultCriteria value might be,
     *   [
     *     { type : "offset", value : 10 },
     *     { type : "limit",  value : 5  },
     *     { type : "sort",   field : "uploadTime", order : "desc" },
     *     { type : "sort",   field : "numLikes"  , order : "asc" }
     *     { type : "option", name  : "stripCanon", value : true }
     *   ]
     *
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : function(classname, searchCriteria, resultCriteria)
    {
      var             ret;
      var             entityType;
      var             canonicalize;
      var             canonFields;
      var             bStripCanon = liberated.dbif.Entity.DEFAULT_STRIP_CANON;
      
      // Get the entity type
      entityType = liberated.dbif.Entity.entityTypeMap[classname];
      if (! entityType)
      {
        throw new Error("No mapped entity type for " + classname);
      }
      
      // Gain easy access to the canonicalize map.
      canonicalize = 
        liberated.dbif.Entity.propertyTypes[entityType].canonicalize;
      if (canonicalize)
      {
        // Get a list of the fields to be mapped
        canonFields = qx.lang.Object.getKeys(canonicalize);
      }

      // Are there any canonicalization functions for this class
      if (canonicalize && searchCriteria)
      {
        // Yup. Rebuild the search criteria, replacing non-canonicalized
        // fields with their peer canonical fields. Start with a clone 
        // of the original criteria, so we don't modify the caller's map.
        searchCriteria = qx.util.Serializer.toNativeObject(searchCriteria);

        // Recursively descend through the search criteria, replacing
        // non-canonicalized field names with their canonical peer.
        (function replaceCanonFields(criterion)
         {
           // Null or undefined means retrieve all objects. 
           if (! criterion)
           {
             // Nothing for us to do
             return;
           }

           // element criterion (type="element" or no type field)?
           if (! criterion.type || criterion.type == "element")
           {
             // Is this field name one to be canonicalized?
             if (qx.lang.Array.contains(canonFields, criterion.field))
             {
               // Replace the value with the canonical version
               criterion.value = 
                 canonicalize[criterion.field].func(criterion.value);

               // Replace the field name with its canonical peer
               criterion.field = canonicalize[criterion.field].prop;
             }
           }
           else if (criterion.children)
           {
             // If there are children, deal with each of them.
             criterion.children.forEach(
               function(child)
               {
                 replaceCanonFields(criterion[child]);
               });
           }
         })(searchCriteria);
      }

      // Issue the query
      ret = liberated.dbif.Entity.__query(classname, 
                                          searchCriteria, 
                                          resultCriteria);
      
      // Match options
      if (resultCriteria)
      {
        resultCriteria.forEach(
          function(criterion)
          {
            if (criterion.type == "option")
            {
              switch(criterion.name)
              {
              case "stripCanon": // strip canonical fields from result
                bStripCanon = criterion.value;
                break;
                
              default:
                this.warn("Unrecognized option name: " + criterion.name);
                break;
              }
            }
          });
      }
      

      // If there is a canonicalization map...
      if (bStripCanon && canonicalize)
      {
        // ... then for each entry in the canonicalization map, ...
        canonFields.forEach(
          function(field)
          {
            // ... delete the corresponding canonical field from the return map
            ret.forEach(
              function(item)
              {
                delete item[canonicalize[field].prop];
              });
          });
      }

      return ret;
    },



    /**
     * Function to query for objects. The actual function that's used depends
     * on which database driver gets installed. The database driver will
     * register the function with us so user code can always use a common
     * entry point to the function, here.
     * 
     * See query() documentation for details.
     */
    __query : function(classname, searchCriteria, resultCriteria)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the query method of the specific database
      // that is being used.
      return [];
    },
    

    /**
     * Function to put an object to the database. The actual function that's
     * used depends on which database driver gets installed. The database
     * driver will register the function with us so user code can always use a
     * common entry point to the function, this.put().
     *
     * @param entity {liberated.dbif.Entity}
     *   The object whose database properties are to be written out.
     */
    __put : function(entity)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the put method of the specific database
      // that is being used.
    },


    /**
     * Function to begin a transaction. The actual function that's used
     * depends on which database driver gets installed. The database driver
     * will register the function with us so user code can always use a common
     * entry point to the function, this.beginTransaction().
     *
     * @return {Object}
     *   A transaction object. It has commit(), rollback(), and isActive() 
     *   methods.
     */
    __beginTransaction : function(entity)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the put method of the specific database
      // that is being used.
    },


    beginTransaction : function()
    {
      // Ensure there's no existing transaction
      if (liberated.dbif.Entity.__transaction)
      {
        throw new Error("Transaction already in progress");
      }

      // Call the driver-specific function to begin a transaction
      liberated.dbif.Entity.__transaction = 
        liberated.dbif.Entity.__beginTransaction();
      
      return liberated.dbif.Entity.__transaction;
    },

    commitTransaction : function()
    {
      // Ensure there's a transaction in progress
      if (! liberated.dbif.Entity.__transaction)
      {
        throw new Error("Commit: No transaction in progress");
      }

      // Call the driver-specific function to commit the transaction
      liberated.dbif.Entity.__transaction.commit();
      
      // There's no longer a transaction in progress
      liberated.dbif.Entity.__transaction = null;
    },

    rollbackTransaction : function()
    {
      // Ensure there's a transaction in progress
      if (! liberated.dbif.Entity.__transaction)
      {
        throw new Error("Rollback: No transaction in progress");
      }

      // Call the driver-specific function to roll back the transaction
      liberated.dbif.Entity.__transaction.rollback();
      
      // There's no longer a transaction in progress
      liberated.dbif.Entity.__transaction = null;
    },

    /**
     * Run a function in a transaction. This checks whether a transaction
     * already exists. If not, it begins one for the duration of this
     * request. It also retries a specified number of times, if the commit
     * fails.
     *
     * @param func {Function}
     *   The function to be run in the transaction
     * 
     * @param args {Array?}
     *   Additional arguments are passed to the specified function.
     * 
     * @param context {Object?}
     *   Context in which the specified function should be called
     */
    asTransaction : function(func, args, context)
    {
      var             i;
      var             bStartedTransaction = false;
      var             transaction = liberated.dbif.Entity.__transaction;
      var             result;
      
      // If no arguments were provided...
      if (typeof args == "undefined")
      {
        args = [];
      }

      // Ensure args is an array, since passing it otherwise is a common error
      if (qx.lang.Type.getClass(args) != "Array")
      {
        throw new Error("'args' parameter must be an array");
      }

      // Is there already a transaction in progress?
      if (! transaction)
      {
        // Nope. Start one.
        transaction = liberated.dbif.Entity.beginTransaction();
        
        // Remember that we started the transaction, so we can commit it too.
        bStartedTransaction = true;
      }
      
      // If no context was specified...
      if (typeof context == "undefined")
      {
        // then provide one
        context = func;
      }

      // Retry a number of times if commit fails
      for (i = 0; i < liberated.dbif.Entity.MAX_COMMIT_TRIES; i++)
      {
        try
        {
          // Write the data
          result = context.apply(func, args);
          
          // Did we begin this transaction?
          if (bStartedTransaction)
          {
            // Yup. Commit it
            liberated.dbif.Entity.commitTransaction();
          }
          
          // All done here. Don't loop again
          break;
        }
        catch (e)
        {
          // An error occurred writing or commiting. Retry.
          if (typeof console != "undefined" && console.warn)
          {
            console.warn("Database Write error: " + e);
          }
        }
      }

      // Ensure there's no pending transaction in progress
      if (bStartedTransaction && transaction.isActive())
      {
        liberated.dbif.Entity.rollbackTransaction();
        
        // This should not have occurred. Let 'em know
        throw new Error("Write failed");
      }
      
      return result;
    },

    /**
     * Remove an entity from the database
     *
     * @param entity {liberated.dbif.Entity}
     *   An instance of the entity to be removed.
     */
    __remove : function(entity)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the remove method of the specific database
      // that is being used.
    },


    /**
     * Add a blob to the database.
     *
     * @param blobData {LongString}
     *   The data to be written as a blob
     *
     * @return {Key}
     *   The blob ID of the just-added blob
     * 
     * @throws {Error}
     *   If an error occurs while writing the blob to the database, an Error
     *   is thrown.
     */
    putBlob : function(blobData)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the putBlob method of the specific
      // database that is being used.
    },


    /**
     * Retrieve a blob from the database
     *
     * @param blobId {Key}
     *   The blob ID of the blob to be retrieved
     * 
     * @return {LongString}
     *   The blob data retrieved from the database. If there is no blob with
     *   the given ID, undefined is returned.
     */
    getBlob : function(entity)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the getBlob method of the specific
      // database that is being used.
    },


    /**
     * Remove a blob from the database
     *
     * @param blobId {Key}
     *   The blob ID of the blob to be removed. If the specified blob id does
     *   not exist, this request fails silently.
     */
    removeBlob : function(entity)
    {
      // This is a temporary place holder.
      // 
      // This method is replaced by the removeBlob method of the specific
      // database that is being used.
    },




    /**
     * Register functions which are specific to a certain database interface
     *
     * @param query {Function}
     *   The database-specific function to be used to query the database. It
     *   must provide the signature of {@link query}.
     *
     * @param put {Function}
     *   The database-specific function to be used to write an entry to the
     *   database. It must provide the signature of {@link __put}.
     *
     * @param remove {Function}
     *   The database-specific function to be used to remove an entry from the
     *   database. It must provide the signature of {@link __remove}.
     *
     * @param getBlob {Function}
     *   The database-specific function to be used to retrieve a blob from the
     *   database. It must provide the signature of {@link __getBlob}.
     *
     * @param putBlob {Function}
     *   The database-specific function to be used to write a blob to the
     *   database. It must provide the signature of {@link __putBlob}.
     *
     * @param removeBlob {Function}
     *   The database-specific function to be used to remove a blob from the
     *   database. It must provide the signature of {@link __removeBlob}.
     *
     * @param beginTransaction {Function}
     *   The database-specific function to be used to begin a transaction. It
     *   must provide the signature of {@link _beginTransaction}.
     *
     * @param custom {Map}
     *   Map containing database driver-specific features.
     */
    registerDatabaseProvider : function(query, put, remove,
                                        getBlob, putBlob, removeBlob,
                                        beginTransaction, custom)
    {
      // Save the specified functions.
      liberated.dbif.Entity.__query = query;
      liberated.dbif.Entity.__put = put;
      liberated.dbif.Entity.__remove = remove;
      liberated.dbif.Entity.getBlob = getBlob;
      liberated.dbif.Entity.putBlob = putBlob;
      liberated.dbif.Entity.removeBlob = removeBlob;
      liberated.dbif.Entity.__beginTransaction = beginTransaction;
      
      // Save custom (per-backend) functions
      liberated.dbif.Entity.custom = custom || {};
    }
  },

  members :
  {
    /**
     * Put the db property data in this object to the database.
     */
    put : function()
    {
      var             name;
      var             entityType = this.getEntityType();
      var             propertyTypes;
      var             canonicalize;
      var             data;
      var             newArray;

      // Retrieve the property data
      data = this.getData();

      // Canonicalize each value that has canonicalization specified
      propertyTypes = liberated.dbif.Entity.propertyTypes[entityType];
      canonicalize = propertyTypes.canonicalize;
      if (canonicalize)
      {
        for (name in canonicalize)
        {
          // If the property is an array type, ...
          if (qx.lang.Array.contains(
                [
                  "KeyArray",
                  "StringArray",
                  "LongStringArray",
                  "NumberArray" 
                ],
                propertyTypes.fields[name]))
          {
            // ... then canonicalize each value within the array
            newArray = [];
            data[name].forEach(
              function(elem)
              {
                newArray.push(canonicalize[name].func(elem));
              });
            data[canonicalize[name].prop] = newArray;
          }
          else
          {
            data[canonicalize[name].prop] = canonicalize[name].func(data[name]);
          }
        }
      }

      // Write this data 
      liberated.dbif.Entity.asTransaction(liberated.dbif.Entity.__put, 
                                          [ this ]);
      
      // This entity is no longer brand new
      this.setBrandNew(false);
    },
    
    /**
     * Remove this entity from the database. 
     * 
     * NOTE: This object should no longer be used after having called this
     *       method!
     */
    removeSelf : function()
    {
      // Remove ourself from the database
      liberated.dbif.Entity.asTransaction(liberated.dbif.Entity.__remove, 
                                          [ this ]);
      
      // Mark this entity as brand new again.
      this.setBrandNew(true);
    },

    /**
     * Provide the map of database properties and their types.
     *
     * @return {Map}
     *   A map where the key is a database property, and the value is its
     *   type. Valid types are "String", "Number", "Array", and "Key". The
     *   latter is database implementation dependent.
     */
    getDatabaseProperties : function()
    {
      var props = liberated.dbif.Entity.propertyTypes[this.getEntityType()];
      return props;
    }
  }
});
