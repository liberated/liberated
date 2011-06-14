/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("rpcjs.sim.Dbif",
{
  extend  : qx.core.Object,
  type    : "abstract",

  construct : function(rpcKey, rpcUrl)
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Save the rpc key
    this.__rpcKey = rpcKey;

    // Initialize the services
    this.__services = {};
    this.__services[rpcKey] =
      {
        features :
        {
        }
      };

    // Start up the RPC simulator
    new rpcjs.sim.Rpc(this.__services, rpcUrl);
  },
  
  statics :
  {
    /** The default database, filled in in the defer() function */
    Database : null,
    
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

      // Initialize our results array
      results = [];

      // If we've been given a key (single field or composite), just look up
      // that single entity and return it.
      switch(qx.lang.Type.getClass(searchCriteria))
      {
      case "Array":
        // Join the field values using a known field separator
        searchCriteria = this.constructor._buildCompositeKey(searchCriteria);

        // fall through

      case "String":
        if (typeof dbObjectMap[searchCriteria] !== "undefined")
        {
          results.push(dbObjectMap[searchCriteria]);
        }
        return results;
      }

      // If they're not asking for all objects, build a criteria predicate.
      if (searchCriteria)
      {
        builtCriteria =
          (function(criterium)
            {
              var             i;
              var             ret = "";
              var             propertyTypes;

              switch(criterium.type)
              {
              case "op":
                switch(criterium.method)
                {
                case "and":
                  // Generate the conditions
                  ret += "(";
                  for (i = 0; i < criterium.children.length; i++)
                  {
                    ret += arguments.callee(criterium.children[i]);
                    if (i < criterium.children.length - 1)
                    {
                      ret += " && ";
                    }
                  }
                  ret += ")";
                  break;

                default:
                  throw new Error("Unrecognized criterium method: " +
                                  criterium.method);
                }
                break;

              case "element":
                // Determine the type of this field
                propertyTypes = rpcjs.dbif.Entity.propertyTypes;
                switch(propertyTypes[type].fields[criterium.field])
                {
                case "Key":
                case "String":
                case "LongString":
                case "Date":
                  ret += 
                    "entry[\"" + criterium.field + "\"] === " +
                    "\"" + criterium.value + "\" ";
                  break;

                case "Integer":
                case "Float":
                  ret +=
                    "entry[\"" + criterium.field + "\"] === " + criterium.value;
                  break;

                case "KeyArray":
                case "StringArray":
                case "LongStringArray":
                  ret +=
                  "qx.lang.Array.contains(entry[\"" + 
                    criterium.field + "\"], " + "\"" + criterium.value + "\")";
                  break;

                case "IntegerArray":
                case "FloatArray":
                  ret +=
                  "qx.lang.Array.contains(entry[\"" + 
                    criterium.field + "\"], " + criterium.value + ")";
                  break;

                default:
                  throw new Error("Unknown property type: " + type);
                }
                break;

              default:
                throw new Error("Unrceognized criterium type: " +
                                criterium.type);
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
          function(criterium)
          {
            switch(criterium.type)
            {
            case "limit":
              limit = criterium.value;
              if (limit <= 0)
              {
                throw new Error("Request for limit <= 0");
              }
              break;
              
            case "offset":
              offset = criterium.value;
              if (offset < 0)
              {
                throw new Error("Request for offset < 0");
              }
              break;
              
            case "sort":
              builtSort = [ "var v1, v2;" ];
              sortKeys = qx.lang.Object.getKeys(criterium.value);
              sortKeys.forEach(
                function(key)
                {
                  {
                    builtSort.push("v1 = a['" + key + "'];");
                    builtSort.push("v2 = b['" + key + "'];");
                    if (criterium.value[key] === "asc")
                    {
                      builtSort.push("if (v1 < v2) return -1;");
                      builtSort.push("if (v1 > v2) return 1;");
                    }
                    else if (criterium.value[key] === "desc")
                    {
                      builtSort.push("if (v1 > v2) return -1;");
                      builtSort.push("if (v1 < v2) return 1;");
                    }
                    else
                    {
                      throw new Error("Unexpected sort order for " + key +
                                      ": " + criterium.value[key]);
                    }
                  }
                });
              builtSort.push("return 0;");
              sortFunction = new Function("a", "b", builtSort.join("\n"));
              break;

            default:
              throw new Error("Unrecognized result criterium type: " +
                              criterium.type);
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
      var             key = entityData[entity.getEntityKeyProperty()];
      var             type = entity.getEntityType();
      var             propertyName;
      
      // If there's no key yet...
      switch(qx.lang.Type.getClass(key))
      {
      case "Undefined":
      case "Null":
        // Generate a new key
        key = String(rpcjs.sim.Dbif.__nextKey++);
        
        // Save this key in the key field
        entityData[entity.getEntityKeyProperty()] = key;
        break;
        
      case "Array":
        // Build a composite key string from these key values
        key = this.constructor._buildCompositeKey(key);
        break;
        
      case "String":
        // nothing special to do
        break;
      }

      // Create a simple map of properties and values to be put in the
      // database
      for (propertyName in entity.getDatabaseProperties())
      {
        // Add this property value to the data to be saved to the database.
        data[propertyName] = entityData[propertyName];
      }

      // Save it to the database
      rpcjs.sim.Dbif.Database[type][key] = data;
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
      var             key = entityData[entity.getEntityKeyProperty()];
      var             type = entity.getEntityType();
      
      delete rpcjs.sim.Dbif.Database[type][key];
    }
  },

  members :
  {
    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <rpcKey>.features namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     */
    registerService : function(serviceName, fService)
    {
      this.__services[this.__rpcKey].features[serviceName] = 
        qx.lang.Function.bind(fService, this);
    },

    /** The top-level RPC key, used to index into this.__services */
    __rpcKey : null,

    /** Remote procedure call services */
    __services : null
  }
});
