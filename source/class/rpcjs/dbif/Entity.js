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
qx.Class.define("rpcjs.dbif.Entity",
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
    var             queryResults;
    var             keyField;
    var             cloneObj;
    var             properties;
    var             entityData;
    var             bComposite;
    var             query;
    var             field;
    var             propertyType;

    // Call the superclass constructor
    this.base(arguments);
    
    // Save the entity type
    this.setEntityType(entityType);
    
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

    // If an entity key was specified...
    if (typeof entityKey != "undefined" && entityKey !== null)
    {
      // ... then query for the object.
      queryResults = 
        rpcjs.dbif.Entity.query(this.constructor.classname, entityKey);
      
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
    for (propertyType in rpcjs.dbif.Entity.propertyTypes[entityType].fields)
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
               rpcjs.dbif.Entity.propertyTypes[entityType].fields))
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
      check : "qx.lang.Type.isString(value) || qx.lang.Type.isArray(value)",
      apply : "_applyEntityKeyProperty"
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
     * Each subclass of rpcjs.dbif.Entity represents a particular object type,
     * and is identified by its class name and by its (shorter) entityType.
     *
     * @param classname {String}
     *   The class name of the concrete subclass of rpcjs.dbif.Entity being
     *   registered.
     *
     * @param entityType {String}
     *   The short entity type name of the subclass being registered.
     */
    registerEntityType : function(classname, entityType)
    {
      // Save this value in the map from classname to entity type
      rpcjs.dbif.Entity.entityTypeMap[classname] = entityType;
    },


    /**
     * Register the property types for an entity class. This is called by each
     * subclass, immediately upon loading the subclass (typically in its
     * defer: function), in order to register the names of the properties
     * (fields) that are stored for each object of this type.
     *
     * @param entityType {String}
     *   The entity type name (as was passed to registerEntityType()), which
     *   uniquely identifies this subclass of rpcjs.dbif.Entity.
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
     */
    registerPropertyTypes : function(entityType, propertyTypes, keyField)
    {
      // If there's no key field name specified...
      if (! keyField)
      {
        // Add "uid" to the list of database properties.
        propertyTypes["uid"] = "Key";
        keyField = "uid";
      }

      rpcjs.dbif.Entity.propertyTypes[entityType] = 
        {
          keyField      : keyField,
          fields        : propertyTypes
        };
    },


    /**
     * Function to query for objects. The actual function that's used depends
     * on which database driver gets installed. The database driver will
     * register the function with us so user code can always use a common
     * entry point to the function, here.
     *
     * @param classname {String}
     *   The name of the class, descended from rpcjs.dbif.Entity, of
     *   the object type which is to be queried in the database.
     *
     * @param searchCriteria {Map?}
     *   A (possibly recursive) map which contains the following members:
     *     type {String}
     *       "op" -- a logical operation. In this case, there must also be a
     *               "method" member which contains the logical operation to
     *               be performed. Currently, the only supported operations
     *               are "and" and "contains". There must also be a "children"
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
     *   An example resultCriteria value might be,
     *   [
     *     { type : "offset", value : 10 },
     *     { type : "limit",  value : 5  },
     *     { type : "sort",   field : "uploadTime", order : "desc" },
     *     { type : "sort",   field : "numLikes" , order : "asc" }
     *   ]
     *
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : function(classname, searchCriteria, resultCriteria)
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
     * @param entity {rpcjs.dbif.Entity}
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
     * Remove an entity from the database
     *
     * @param entity {rpcjs.dbif.Entity}
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
     */
    registerDatabaseProvider : function(query, put, remove)
    {
      // Save the specified functions.
      rpcjs.dbif.Entity.query = query;
      rpcjs.dbif.Entity.__put = put;
      rpcjs.dbif.Entity.__remove = remove;
    }
  },

  members :
  {
    /**
     * Put the db property data in this object to the database.
     */
    put : function()
    {
      // Write this data 
      rpcjs.dbif.Entity.__put(this);
      
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
      rpcjs.dbif.Entity.__remove(this);
      
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
      var props = rpcjs.dbif.Entity.propertyTypes[this.getEntityType()];
      return props;
    },
    
    // property apply function
    _applyEntityKeyProperty : function(value, old)
    {
      if (qx.lang.Type.isArray(value))
      {
/*
 * At the time that setEntityKeyProperty() is called from the Obj*
 * constructor, the entity type has not yet been set.

        var properties = rpcjs.dbif.Entity.propertyTypes[this.getEntityType()];
        value.forEach(
          function(subcomponent)
          {
            if (! qx.lang.Array.contains(properties, subcomponent))
            {
              throw new Error("Unexpected property in key: " + subcomponent);
            }
          });
*/
      }
    }
  }
});
