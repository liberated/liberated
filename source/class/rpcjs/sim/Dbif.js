/**
 * Copyright (c) 2011 Derrell Lipman
 * Copyright (c) 2011 Reed Spool
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("rpcjs.sim.Dbif",
{
  extend  : qx.core.Object,
  type    : "abstract",

  statics :
  {
    /** The default database. See {@link setDb}. */
    Database : null,
    
    /** The database map entry to use for blobs */
    BlobStorage : "**BLOB**",

    /** 
     * The next value to use for an auto-generated key for an entity
     */
    __nextKey : 0,

    /*
     * Build a composite key.
     *
     * By default, this separates the key values using ASCII value 31, which
     * is "Unit Separator". Applications that require that value to be
     * allowable in key component values may replace this method with one that
     * builds the key differently.
     */
    _buildCompositeKey : function(keyArr)
    {
      return keyArr.join(String.fromCharCode(31));
    },

    
    /**
     * Save the user-specified database.
     *
     * @param db {Map}
     *   The database map. Each top-level key in this map is an object type,
     *   which contains a map of key/value pairs.
     */
    setDb : function(db)
    {
      rpcjs.sim.Dbif.Database = db;
    },


    /**
     * Query for all entities of a given class/type, given certain criteria.
     *
     * @param classname {String}
     *   The name of the class, descended from rpcjs.dbif.Entity, of
     *   the object type which is to be queried in the database.
     *
     * @param searchCriteria
     *   See {@link rpcjs.dbif.Entity#query} for details.
     *
     * @param resultCriteria
     *   See {@link rpcjs.dbif.Entity#query} for details.
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : function(classname, searchCriteria, resultCriteria)
    {
      var             i;
      var             qualifies;
      var             builtCriteria;
      var             dbObjectMap;
      var             type;
      var             entry;
      var             propertyName;
      var             result;
      var             results;
      var             entity;
      var             clone;
      var             val;
      var             limit = Number.MAX_VALUE;
      var             offset = 0;
      var             sortKeys;
      var             builtSort;
      var             sortFunction;

      // Get the entity type
      type = rpcjs.dbif.Entity.entityTypeMap[classname];
      if (! type)
      {
        throw new Error("No mapped entity type for " + classname);
      }
      
      // Get the database sub-section for the specified classname/type
      dbObjectMap = rpcjs.sim.Dbif.Database[type];
      
      if (qx.core.Environment.get("qx.debug"))
      {
        if (! dbObjectMap)
        {
          throw new Error("Type '" + type + "' " +
                          "was not found in the simulation database.");
        }
      }

      // Initialize our results array
      results = [];

      // If we've been given a key (single field or composite), just look up
      // that single entity and return it.
      switch(qx.lang.Type.getClass(searchCriteria))
      {
      case "Array":
        // Join the field values using a known field separator
        searchCriteria = rpcjs.sim.Dbif._buildCompositeKey(searchCriteria);

        // fall through

      case "Number":
      case "String":
        if (typeof dbObjectMap[searchCriteria] !== "undefined")
        {
          // Make a deep copy of the results
          result =
            qx.util.Serializer.toNativeObject(dbObjectMap[searchCriteria]);
          results.push(result);
        }
        return results;
      }

      // If they're not asking for all objects, build a criteria predicate.
      if (searchCriteria)
      {
        builtCriteria =
          (function(criterion)
            {
              var             i;
              var             ret = "";
              var             propertyTypes;
              var             filterOp;
              
              // Convert or determine the filter operation
              filterOp = 
                (function(filterOp)
                 {
                   switch(filterOp)
                   {
                   case "<=":
                   case "<":
                   case ">":
                   case ">=":
                     return filterOp; // Use filter operation as provided
                     
                   case "!=":
                     return "!==";    // "Not identical"

                   case "=":
                   case undefined:
                     return "===";    // "Identical"
                     
                   default:
                     throw new Error("Unexpected filter operation: " + 
                                     filterOp);
                   }
                 })(criterion.filterOp);

              switch(criterion.type)
              {
              case "op":
                switch(criterion.method)
                {
                case "and":
                  // Generate the conditions
                  ret += "(";
                  for (i = 0; i < criterion.children.length; i++)
                  {
                    ret += arguments.callee(criterion.children[i]);
                    if (i < criterion.children.length - 1)
                    {
                      ret += " && ";
                    }
                  }
                  ret += ")";
                  break;

                default:
                  throw new Error("Unrecognized criterion method: " +
                                  criterion.method);
                }
                break;

              case "element":
                // Determine the type of this field
                propertyTypes = rpcjs.dbif.Entity.propertyTypes;
                switch(propertyTypes[type].fields[criterion.field])
                {
                case "String":
                case "LongString":
                case "Date":
                  if (typeof criterion.value != "string")
                  {
                    qx.Bootstrap.warn(
                      "Expected criterion value to be string, " +
                      "got " + typeof(criterion.value));
                    ret += "false";
                  }
                  else
                  {
                    ret += 
                      "entry[\"" + criterion.field + "\"] " + filterOp +
                      "\"" + criterion.value + "\" ";
                  }
                  break;

                case "Key":
                case "Integer":
                case "Float":
                  if (typeof criterion.value != "number")
                  {
                    qx.Bootstrap.warn(
                      "Expected criterion value to be number, " +
                      "got " + typeof(criterion.value));
                    ret += "false";
                  }
                  else
                  {
                    ret +=
                      "entry[\"" + criterion.field + "\"] " + filterOp +
                      criterion.value;
                  }
                  break;

                case "KeyArray":
                case "StringArray":
                case "LongStringArray":
                  if (typeof criterion.value != "string")
                  {
                    qx.Bootstrap.warn(
                      "Expected criterion value to be string, " +
                      "got " + typeof(criterion.value));
                    ret += "false";
                  }
                  else if (criterion.filterOp)
                  {
                    qx.Bootstrap.warn(
                      "Filter operations can not be applied to array types");
                  }
                  else
                  {
                    ret +=
                      "qx.lang.Array.contains(entry[\"" + 
                      criterion.field + "\"], " + 
                      "\"" + criterion.value + "\")";
                  }
                  break;

                case "IntegerArray":
                case "FloatArray":
                  if (typeof criterion.value != "number")
                  {
                    qx.Bootstrap.warn(
                      "Expected criterion value to be string, " +
                      "got " + typeof(criterion.value));
                    ret += "false";
                  }
                  else if (criterion.filterOp)
                  {
                    qx.Bootstrap.warn(
                      "Filter operations can not be applied to array types");
                  }
                  else
                  {
                    ret +=
                      "qx.lang.Array.contains(entry[\"" + 
                      criterion.field + "\"], " + criterion.value + ")";
                  }
                  break;

                default:
                  throw new Error("Unknown property type: " + type);
                }
                break;

              default:
                throw new Error("Unrecognized criterion type: " +
                                criterion.type);
              }

              return ret;
            })(searchCriteria);

        // Create a function that implements the specified criteria
        qualifies = new Function(
          "entry",
          "return (" + builtCriteria + ");");
      }
      else
      {
        // They want all entities of the specified type.
        qualifies = function(entity) { return true; };
      }
      
      // Assume no required sort order
      sortFunction = null;

      // If there are any result criteria specified...
      if (resultCriteria)
      {
        // ... then go through the criteria list and handle each.
        resultCriteria.forEach(
          function(criterion)
          {
            switch(criterion.type)
            {
            case "limit":
              limit = criterion.value;
              if (limit <= 0)
              {
                throw new Error("Request for limit <= 0");
              }
              break;
              
            case "offset":
              offset = criterion.value;
              if (offset < 0)
              {
                throw new Error("Request for offset < 0");
              }
              break;
              
            case "sort":
              builtSort = [ "var v1, v2;" ];
              
              builtSort.push("v1 = a['" + criterion.field + "'];");
              builtSort.push("v2 = b['" + criterion.field + "'];");
              
              if ( criterion.order === "asc" )
              {
                builtSort.push("if (v1 < v2) return -1;");
                builtSort.push("if (v1 > v2) return 1;");
              }
              else if (criterion.order === "desc" )
              {
                builtSort.push("if (v1 > v2) return -1;");
                builtSort.push("if (v1 < v2) return 1;");
              }
              else
              {
                throw new Error(
                  "Unexpected sort order for " + criterion.field + ": " + 
                  criterion.order);
              }
              
              builtSort.push("return 0;");
              sortFunction = new Function("a", "b", builtSort.join("\n"));
              break;
              
            default:
              throw new Error("Unrecognized result criterion type: " +
                              criterion.type);
            }
          });
      }

      for (entry in dbObjectMap)
      {
        if (qualifies(dbObjectMap[entry]))
        {
          // Make a deep copy of the results
          result = qx.util.Serializer.toNativeObject(dbObjectMap[entry]);
          results.push(result);
        }
      }
      
      // Sort the results
      if (sortFunction)
      {
        results.sort(sortFunction);
      }
      
      // Give 'em the query results, with the appropriate offset and limit.
      return results.slice(offset, offset + limit);
    },


    /**
     * Put an entity to the database. If the key field is null or undefined, a
     * key is automatically generated for the entity.
     *
     * @param entity {rpcjs.dbif.Entity}
     *   The entity to be made persistent.
     */
    put : function(entity)
    {
      var             data = {};
      var             entityData = entity.getData();
      var             keyProperty = entity.getEntityKeyProperty();
      var             type = entity.getEntityType();
      var             propertyName;
      var             fields;
      var             key;
      var             keyFields = [];
      
      // Are we working with a composite key?
      if (qx.lang.Type.getClass(keyProperty) == "Array")
      {
        // Yup. Build the composite key from these fields
        keyProperty.forEach(
          function(fieldName)
          {
            keyFields.push(entityData[fieldName]);
          });
        key = rpcjs.sim.Dbif._buildCompositeKey(keyFields);
      }
      else
      {
        // Retrieve the (single field) key
        key = entityData[keyProperty];
      }

      // Get the field names for this entity type
      fields = entity.getDatabaseProperties().fields;

      // If there's no key yet...
      switch(qx.lang.Type.getClass(key))
      {
      case "Undefined":
      case "Null":
        // Generate a new key. Determine what type of key to use.
        switch(fields[keyProperty])
        {
        case "Key":
        case "Number":
          key = rpcjs.sim.Dbif.__nextKey++;
          break;
          
        case "String":
          key = String(rpcjs.sim.Dbif.__nextKey++);
          break;
          
        default:
          throw new Error("No way to autogenerate key");
        }
        
        // Save this key in the key field
        entityData[entity.getEntityKeyProperty()] = key;
        break;
        
      case "Number":
        // If there's no key, then generate a new key
        if (isNaN(key))
        {
          key = String(rpcjs.sim.Dbif.__nextKey++);
        }
        
        // Save this key in the key field
        entityData[entity.getEntityKeyProperty()] = key;
        break;
        
      case "Array":
        // Build a composite key string from these key values
        key = rpcjs.sim.Dbif._buildCompositeKey(key);
        break;
        
      case "String":
        // nothing special to do
        break;
      }

      // Create a simple map of properties and values to be put in the
      // database
      for (propertyName in entity.getDatabaseProperties().fields)
      {
        // Add this property value to the data to be saved to the database.
        data[propertyName] = entityData[propertyName];
      }

      // Save it to the database
      rpcjs.sim.Dbif.Database[type][key] = data;
      
      // Write it to Web Storage
      if (typeof window.localStorage !== "undefined")
      {
        qx.Bootstrap.debug("Writing DB to Web Storage");
        localStorage.simDB = qx.lang.Json.stringify(rpcjs.sim.Dbif.Database);
      }
    },
    

    /**
     * Remove an entity from the database
     *
     * @param entity {rpcjs.dbif.Entity}
     *   An instance of the entity to be removed.
     */
    remove : function(entity)
    {
      var             entityData = entity.getData();
      var             keyProperty = entity.getEntityKeyProperty();
      var             type = entity.getEntityType();
      var             propertyName;
      var             fields;
      var             key;
      var             keyFields = [];
      
      // Are we working with a composite key?
      if (qx.lang.Type.getClass(keyProperty) == "Array")
      {
        // Yup. Build the composite key from these fields
        keyProperty.forEach(
          function(fieldName)
          {
            keyFields.push(entityData[fieldName]);
          });
        key = rpcjs.sim.Dbif._buildCompositeKey(keyFields);
      }
      else
      {
        // Retrieve the (single field) key
        key = entityData[keyProperty];
      }

      delete rpcjs.sim.Dbif.Database[type][key];
      
      // Write it to Web Storage
      if (typeof window.localStorage !== "undefined")
      {
        qx.Bootstrap.debug("Writing DB to Web Storage");
        localStorage.simDB = qx.lang.Json.stringify(rpcjs.sim.Dbif.Database);
      }
    },
    
    /**
     * Add a blob to the database.
     *
     * @param blobData {LongString}
     *   The data to be written as a blob
     *
     * @return {String}
     *   The blob ID of the just-added blob
     * 
     * @throws {Error}
     *   If an error occurs while writing the blob to the database, an Error
     *   is thrown.
     */
    putBlob : function(blobData)
    {
      var             blobStorage = rpcjs.sim.Dbif.BlobStorage;
      var             Db = rpcjs.sim.Dbif.Database;
      var             key;

      // If there's no blob storage yet...
      if (! Db[blobStorage])
      {
        // ... then create it.
        Db[blobStorage] = {};
      }
      
      // Retrieve the next id value to use as this blob id
      key = rpcjs.sim.Dbif.__nextKey++;
      
      // Convert it to a string, to allow consistency with other backends
      key = key + "";

      // Store the blob
      Db[blobStorage][key] = blobData;
      
      // Give 'em the blob id
      return key;
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
    getBlob : function(blobId)
    {
      var             blobStorage = rpcjs.sim.Dbif.BlobStorage;
      var             Db = rpcjs.sim.Dbif.Database;

      // Is there any blob storage?
      if (! Db[blobStorage])
      {
        // Nope. The blob must not exist. Not found.
        return undefined;
      }
      
      // Return the specified blob (or undefined, if it's not there).
      return Db[blobStorage][blobId];
    },
    
    /**
     * Remove a blob from the database
     *
     * @param blobId {Key}
     *   The blob ID of the blob to be removed. If the specified blob id does
     *   not exist, this request fails silently.
     */
    removeBlob : function(blobId)
    {
      var             blobStorage = rpcjs.sim.Dbif.BlobStorage;
      var             Db = rpcjs.sim.Dbif.Database;

      // Is there any blob storage?
      if (! Db[blobStorage])
      {
        // Nope. The blob must not exist.
        return;
      }
      
      // Delete the specified blob
      delete Db[blobStorage][blobId];
    }
  }
});
