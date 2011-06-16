/**
 * Copyright (c) 2011 Derrell Lipman
 * Copyright (c) 2011 Reed Spool
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("rpcjs.appengine.Dbif",
{
  extend  : qx.core.Object,
  type    : "abstract",

  construct : function(rpcKey, rpcUrl)
  {
    // Call the superclass constructor
    this.base(arguments, rpcKey);

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

    // Start up the App Engine RPC engine
    this.__rpcHandler = new rpcjs.appengine.Rpc(this.__services, rpcUrl);
  },
  
  statics :
  {
    /**
     * The remote procedure code server for App Engine
     */
    __rpcHandler : null,

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
     * @param criteria
     *   See {@link rpcjs.dbif.Entity#query} for details.
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : function(classname, searchCriteria, resultCriteria)
    {
      var             i;
      var             Datastore;
      var             datastore;
      var             Query;
      var             query;
      var             preparedQuery;
      var             options;
      var             type;
      var             fields;
      var             dbResult;
      var             dbResults;
      var             result;
      var             results;
      var             propertyTypes;
      var             resultLimit;
      var             resultOffset;
      
      // Get the entity type
      type = rpcjs.dbif.Entity.entityTypeMap[classname];
      if (! type)
      {
        throw new Error("No mapped entity type for " + classname);
      }
      
      // Get the field names for this entity type
      propertyTypes = rpcjs.dbif.Entity.propertyTypes;
      fields = propertyTypes[type].fields;

      // Initialize our results array
      results = [];

      // Get the datastore service
      Datastore = Packages.com.google.appengine.api.datastore;
      datastore = Datastore.DatastoreServiceFactory.getDatastoreService();

      // If we've been given a key (single field or composite), just look up
      // that single entity and return it.
      switch(qx.lang.Type.getClass(searchCriteria))
      {
      case "Array":
        // Build the composite key
        searchCriteria = this.constructor._buildCompositeKey(searchCriteria);
        // fall through

      case "Number":
      case "String":
        // We've been given a key. Try to retrieve the specified entity.
        try
        {
          result =
            datastore.get(Datastore.KeyFactory.createKey(type, searchCriteria));
        }
        catch(e)
        {
          // Entity not found
          return [];
        }
        
        dbResults = [];
        dbResults.push(result);

        // Make dbResults look like a Java array, so we can convert its
        // contents to JavaScript types in code which is common with a Query
        // result set.
        dbResults.hasNext = function() { return this.length > 0; };
        dbResults.next = function() { return this.shift(); };
        break;

      default:
        // Create a new query
        Query = Datastore.Query;
        query = new Query(type);

        // If they're not asking for all objects, build a criteria predicate.
        if (searchCriteria)
        {
            (function(criterium)
              {
                var             filterOp;

                switch(criterium.type)
                {
                case "op":
                  switch(criterium.method)
                  {
                  case "and":
                    // Generate the conditions specified in the children
                    criterium.children.forEach(arguments.callee);
                    break;

                  default:
                    throw new Error("Unrecognized criterium method: " +
                                    criterium.method);
                  }
                  break;

                case "element":
                  // Map the specified filter operator to the db's filter ops.
                  filterOp = criterium.filterOp || "=";
                  switch(filterOp)
                  {
                  case "<=":
                    filterOp = Query.FilterOperator.LESS_THAN_OR_EQUAL;
                    break;

                  case "<":
                    filterOp = Query.FilterOperator.LESS_THAN;
                    break;

                  case "=":
                    filterOp = Query.FilterOperator.EQUAL;
                    break;

                  case ">":
                    filterOp = Query.FilterOperator.GREATER_THAN;
                    break;

                  case ">=":
                    filterOp = Query.FilterOperator.GREATER_THAN_OR_EQUAL;
                    break;

                  case "!=":
                    filterOp = Query.FilterOperator.NOT_EQUAL;
                    break;

                  default:
                    throw new Error("Unrecognized logical operation: " +
                                    criterium.filterOp);
                  }

                  // Add a filter using the provided parameters
                  if (fields[criterium.field] == "Integer" ||
                      fields[criterium.field] == "Key")
                  {
                    query.addFilter(criterium.field, 
                                    filterOp,
                                    java.lang.Integer(criterium.value));
                  }
                  else
                  {
                    query.addFilter(criterium.field, 
                                    filterOp,
                                    criterium.value);
                  }
                  break;

                default:
                  throw new Error("Unrceognized criterium type: " +
                                  criterium.type);
                }
              })(searchCriteria);
        }
        
        
        // Assume the default set of result criteria (no limits, offset=0)
        options = Datastore.FetchOptions.Builder.withDefaults();
        
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
                options.limit(criterium.value);
                break;

              case "offset":
                options.offset(criterium.value);
                break;

              case "sort":
                query.addSort(criterium.field,
                              {
                                "asc"  : Query.SortDirection.ASCENDING,
                                "desc" : Query.SortDirection.DESCENDING
                              }[criterium.order]);
                break;
                
              default:
                throw new Error("Unrecognized result criterium type: " +
                criterium.type);
              }
            });
        }

        // Prepare to issue a query
        preparedQuery = datastore.prepare(query);

        // Issue the query
        dbResults = preparedQuery.asIterator(options);
        break;
      }
      
      // Process the query results
      while (dbResults.hasNext())
      {
        // Initialize a map for the result data
        result = {};
        
        // Get the next result
        dbResult = dbResults.next();
        
        // Pull all of the result properties into the entity data
        for (fieldName in fields)
        {
          // Map the Java field data to appropriate JavaScript data
          result[fieldName] =
            (function(value, type)
             {
               var             ret;
               var             Text;
               var             iterator;

               switch(type)
               {
               case "String":
               case "Date":
                 return(String(value));

               case "LongString":
                 return value ? String(value.getValue()) : value;

               case "Key":
               case "Integer":
               case "Float":
                 return(Number(value));

               case "KeyArray":
               case "StringArray":
               case "LongStringArray":
               case "NumberArray":
                 if (value)
                 {
                   // Initialize the return array
                   ret = [];

                   // Determine the type of the elements
                   var elemType = type.replace(/Array/, "");
                   
                   // Convert the elements to their proper types
                   iterator = value.iterator();
                   while (iterator.hasNext())
                   {
                     // Call ourself with this element
                     ret.push(arguments.callee(iterator.next(), elemType));
                   }
                   
                   return ret;
                 }
                 else
                 {
                   return [];
                 }

               default:
                 throw new Error("Unknown property type: " + type);
               }
             })(dbResult.getProperty(fieldName), fields[fieldName]);
        }

        // Save this result
        results.push(result);
      }
      
      // Give 'em the query results!
      return results;
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
      var             dbKey;
      var             dbEntity;
      var             datastore;
      var             Datastore;
      var             entityData = entity.getData();
      var             key = entityData[entity.getEntityKeyProperty()];
      var             type = entity.getEntityType();
      var             propertyName;
      var             fields;
      var             data;
      
      // Ensure that there's either a real key or no key; not empty string
      if (key === "")
      {
        throw new Error("Found disallowed empty key");
      }

      // If there's no key yet...
      switch(qx.lang.Type.getClass(key))
      {
      case "Undefined":
      case "Null":
        // Generate a new key
        key = String(rpcjs.appengine.Dbif.__nextKey++);
        
        // Save this key in the key field
        entityData[entity.getEntityKeyProperty()] = key;
        break;
        
      case "Number":
        // If there's no key, then generate a new key
        if (isNaN(key))
        {
          key = String(rpcjs.appengine.Dbif.__nextKey++);
        }
        
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

      // Create the database key value
      Datastore = Packages.com.google.appengine.api.datastore;
      dbKey = Datastore.KeyFactory.createKey(entity.getEntityType(), key);

      // Create an App Engine entity to store in the database
      dbEntity = new Packages.com.google.appengine.api.datastore.Entity(dbKey);

      // Add each property to the database entity
      fields = entity.getDatabaseProperties().fields;
      for (fieldName in fields)
      {
        // Map the Java field data to appropriate JavaScript data
        data =
          (function(value, type)
           {
             var             i;
             var             v;
             var             conv;
             var             jArr;

             switch(type)
             {
             case "String":
             case "Float":
               return value;

             case "Key":
             case "Integer":
               // Convert JavaScript Number to Java Long to avoid floating point
               return java.lang.Long(String(value));

             case "LongString":
               var Text = Packages.com.google.appengine.api.datastore.Text;
               return value ? new Text(value) : value;

             case "KeyArray":
             case "StringArray":
             case "LongStringArray":
             case "IntegerArray":
             case "FloatArray":
               if (type == "IntegerArray")
               {
                 // integer Numbers must be converted to Java longs to avoid
                 // having them saved as floating point values.
                 conv = function(val)
                 {
                   return java.lang.Long(String(val));
                 };
               }
               else
               {
                 conv = function(val)
                 {
                   return val;
                 };
               }

               jArr = new java.util.ArrayList();
               for (i = 0; value && i < value.length; i++)
               {
                 jArr.add(arguments.callee(conv(value[i]),
                                           type.replace(/Array/, "")));
               }
               return jArr;

             default:
               throw new Error("Unknown property type: " + type);
             }
           })(entityData[fieldName], fields[fieldName]);

        // Save this result
        dbEntity.setProperty(fieldName, data);
      }

      // Save it to the database
      datastore = Datastore.DatastoreServiceFactory.getDatastoreService();
      datastore.put(dbEntity);
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
      var             dbKey;
      var             datastore;
      var             Datastore;
      
      // Create the database key value
      Datastore = Packages.com.google.appengine.api.datastore;
      dbKey = Datastore.KeyFactory.createKey(type, key);

      // Remove this entity from the database
      datastore = Datastore.DatastoreServiceFactory.getDatastoreService();
      datastore["delete"](dbKey);
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
    
    
    /**
     * Process a single request.
     *
     * @param jsonData {String}
     *   The data provide in a POST request
     *
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned.
     */
    processRequest : function(jsonData)
    {
      return this.__rpcHandler.processRequest(jsonData);
    },

    /** The top-level RPC key, used to index into this.__services */
    __rpcKey : null,

    /** Remote procedure call services */
    __services : null
  },
  
  defer : function()
  {
    // Register our put, query, and remove functions
    rpcjs.dbif.Entity.registerDatabaseProvider(
      rpcjs.appengine.Dbif.query,
      rpcjs.appengine.Dbif.put,
      rpcjs.appengine.Dbif.remove);
  }
});
