/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("rpcjs.dbif.Entity",
{
  extend : qx.core.Object,
  
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

    // Call the superclass constructor
    this.base(arguments);
    
    // Save the entity type
    this.setEntityType(entityType);
    
    // Get the key field name.
    keyField = this.getEntityKeyProperty();
    
    // The key field can be a string or an array. Ensure that the types match
    // between the key field and the entity key.
    if (qx.core.Environment.get("qx.debug"))
    {
      if (typeof(keyField) != typeof(entityKey) ||
          (qx.lang.Type.getClass(keyField) == "Array" &&
           keyField.length != entityKey.length))
      {
        throw new Error("Entity key does not match key type");
      }
    }
    
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
    if (typeof entityKey != "undefined")
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
    rpcjs.dbif.Entity.propertyTypes[entityType].forEach(
      function(propertyType)
      {
        // If this property type is not represented in the entity data...
        if (typeof(entityData[propertyType]) == "undefined")
        {
          // ... then add it, with a null value.
          entityData[propertyType] = null;
        }
      });
    
    // If we're in debugging mode...
    if (qx.core.Environment.get("qx.debug"))
    {
      // ... then ensure that there are no properties that don't belong
      entityData.forEach(
        function(propertyType)
        {
          if (! qx.lang.Array.contains(
                rpcjs.dbif.Entity.propertyTypes[entityType],
                propertyType))
          {
            throw new Error("Unrecognized property (" + propertyType + ")" +
                            " in entity data for type " + entityType + ".");
          }
        });
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
     * primary key).
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

    /*
     * The unique id to be used as the database entity key (aka primary key),
     * if no other property has been designated in entityKeyProperty as the
     * primary key.
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


    /** Register an entity type */
    registerEntityType : function(classname, entityType)
    {
      // Save this value in the map from classname to entity type
      rpcjs.dbif.Entity.entityTypeMap[classname] = entityType;
    },


    /** Register the property types for an entity class */
    registerPropertyTypes : function(entityType, propertyTypes, keyField)
    {
      // If there's no key field name specified...
      if (! keyField)
      {
        // Add "uid" to the list of database properties.
        propertyTypes["uid"] = "Key";
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
     *               An optional "filterOp" member may also be provided. If
     *               none is provided, the requested operation is assumed to be
     *               equality. Any of the following values may be provided for
     *               the "filterOp" member: "<", "<=", "=", ">", ">=", "!=".
     *
     *       "element" -- Search by specific field in the object. The
     *                    "field" member must be provided, to specify which
     *                    field, and a "value" member must be specified, to
     *                    indicate what value must be in that field.
     *
     *   If no criteria is supplied (undefined or null), then all objects of
     *   the specified classname will be returned.
     *
     * @param resultCriteria {Array?}
     *   An array of maps. Each map contains two members: "type" and
     *   "value". The "type" member is one of "offset", "limit" or
     *   "sort". When type is "offset", "value" indicates how many initial
     *   objects to skip before the first one that is returned. When type is 
     *   "limit", the "value" is how many result objects to return. When
     *   "type" is "sort", the "value" is itself a map of fieldname/direction
     *   pairs. Direction can be either "desc" or "asc".
     *
     *   An example resultCritieria value might be,
     *   [
     *     { type : "offset", value : 10 },
     *     { type : "limit",  value : 5  },
     *     { type : "sort",   value : { owner : "asc", uploadTime : "desc" }
     *   ]
     *
     *   If no criteria is supplied (undefined or null), then the sort order
     *   is undefined, and all entities that match the search criteria will be
     *   returned.
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : null,
    

    /**
     * Function to put an object to the database. The actual function that's
     * used depends on which database driver gets installed. The database
     * driver will register the function with us so user code can always use a
     * common entry point to the function, this.put().
     *
     * @param entity {rpcjs.dbif.Entity}
     *   The object whose database properties are to be written out.
     */
    __put : null,


    /** Register a put and query function, specific to a database */
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
      return rpcjs.dbif.Entity.propertyTypes[this.getEntityType()];
    },
    
    // property apply function
    _applyEntityKeyProperty : function(value, old)
    {
      if (qx.lang.Type.isArray(value))
      {
        var properties = rpcjs.dbif.Entity.propertyTypes[this.getEntityType()];
        value.forEach(
          function(subcomponent)
          {
            if (! qx.lang.Array.contains(properties, subcomponent))
            {
              throw new Error("Unexpected property in key: " + subcomponent);
            }
          });
      }
    }
  }
});