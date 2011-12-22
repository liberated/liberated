/**
 * Copyright (c) 2011 Derrell Lipman
 * Copyright (c) 2011 Reed Spool
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("liberated.jetty.SqliteDbif",
{
  extend  : qx.core.Object,
  type    : "abstract",

  statics :
  {
    /** Name of the database file */
    __dbName       : null,
    
    /** Handle to the open database */
    __db : null,

    
    /**
     * Set the name of the SQLite database
     * 
     * @param name {String}
     *   The name of the database file.
     */
    setDatabaseName : function(name)
    {
      this.__dbName = name;
    },


    /**
     * Query for all entities of a given class/type, given certain criteria.
     *
     * @param classname {String}
     *   The name of the class, descended from liberated.dbif.Entity, of
     *   the object type which is to be queried in the database.
     *
     * @param criteria
     *   See {@link liberated.dbif.Entity#query} for details.
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
      var             params;
      var             preparedQuery;
      var             options;
      var             type;
      var             fields;
      var             fieldName;
      var             keyField;
      var             dbResult;
      var             dbResults;
      var             result;
      var             results;
      var             propertyTypes;
      var             resultLimit;
      var             resultOffset;
      var             limit;
      var             offset;
      var             sort;
      var             obj;
      
      // Get the entity type
      type = liberated.dbif.Entity.entityTypeMap[classname];
      if (! type)
      {
        throw new Error("No mapped entity type for " + classname);
      }
      
      // Get the field names for this entity type
      propertyTypes = liberated.dbif.Entity.propertyTypes;
      keyField = propertyTypes[type].keyField;
      fields = propertyTypes[type].fields;

      // Initialize our results array
      results = [];

      // If we've been given a key (single field or composite), build a simple
      // query to locate it.
      switch(qx.lang.Type.getClass(searchCriteria))
      {
      case "Array":
        params = [];
        query = "SELECT * FROM " + type + " WHERE ";
        keyField.forEach(
          function(fieldName, i)
          {
            // If this isn't the first field specifier...
            if (i != 0)
            {
              // ... then we need a conjugation
              query += " AND ";
            }
            
            // Add a spec for this field and a place holder for its value.
            query += fieldName + " = ?" + i;
            
            // Create a parameter entry for this field
            params.push(
              {
                value : searchCriteria[i],
                type  : fields[fieldName]
              });
          });
        break;

      case "Number":
      case "String":
        // We've been given a non-composite key
        params = [];
        query = "SELECT * FROM " + type + " WHERE " + keyField + " = ?0";
        params.push(
          {
            value : searchCritieria,
            type  : fields[keyField]
          });
        break;

      default:
        // Create a new query
        params = [];
        query = [];
        query.push("SELECT * FROM " + type + " WHERE ");

        // If they're not asking for all objects, build a criteria predicate.
        if (searchCriteria)
        {
            (function(criterion)
              {
                var             filterOp;
                var             callee = arguments.callee;

                switch(criterion.type)
                {
                case "op":
                  switch(criterion.method)
                  {
                  case "and":
                    // Generate the conditions specified in the children
                    query.push("(");
                    criterion.children.forEach(
                      function(child, i)
                      {
                        if (i != 0)
                        {
                          query.push(" AND ");
                        }
                        query.push("(");
                        callee(child);
                        query.push(")");
                      });
                    break;

                  default:
                    throw new Error("Unrecognized criterion method: " +
                                    criterion.method);
                  }
                  break;

                case "element":
                  // Map the specified filter operator to the db's filter ops.
                  filterOp = criterion.filterOp || "=";

                  // Add a filter using the provided parameters
                  query.push(criterion.field)
                  query.push(filterOp);
                  query.push("?" + params.length);
                  params.push(
                    {
                      value : criterion.value,
                      type  : fields[criterion.field]
                    });
                  break;

                default:
                  throw new Error("Unrceognized criterion type: " +
                                  criterion.type);
                }
              })(searchCriteria);
        }
        
        query = query.join("");
        
        // If there are any result criteria specified...
        if (resultCriteria)
        {
          // ... then add them. First, determine which are provided.
          limit = "";
          offset = "";
          sort = "";

          resultCriteria.forEach(
            function(criterion)
            {
              switch(criterion.type)
              {
              case "limit":
                limit = " LIMIT ?" + params.length;
                params.push(
                  {
                    value : criterion.value,
                    type  : "Integer"
                  });
                break;

              case "offset":
                offset = " OFFSET ?" + params.length;
                params.push(
                  {
                    value : criterion.value,
                    type  : "Integer"
                  });
                break;

              case "sort":
                sort = " ORDER BY ?" + criterion.field + " " + criterion.order;
                params.push(
                  {
                    value : criterion.field,
                    type  : "String"
                  });
                params.push(
                  {
                    value : criterion.order,
                    type  : "String"
                  });
                break;
                
              default:
                throw new Error("Unrecognized result criterion type: " +
                criterion.type);
              }
            });
          
          // Now add all of them to the query in the desired order.
          query += sort + offset + limit;
        }
        break;
      }
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Bind the parameters
        params.forEach(
          function(param, i)
          {
            preparedQuery.bind(i, param.value);
          });

        // Execute the query
        dbResults = [];
        while (preparedQuery.step())
        {
          obj = {};
          for (i = preparedQuery.columnCount() - 1; i >= 0; i--)
          {
            // Get this column's field name
            fieldName = preparedQuery.getColumnName(i);

            // Determine the type for this field, and retrieve the value
            obj[fieldName] = columnValue(i);
          }

          dbResults.push(obj);
        }
      }
      finally
      {
        preparedQuery.dispose();
      }

      // Initialize a map for the result data
      result = {};

      // Process the query results
      dbResults.forEach(
        function(dbResult)
        {
          // Pull all of the result properties into the entity data
          for (fieldName in fields)
          {
            // Map the Java Object to its appropriate JavaScript data
            result[fieldName] =
              (function(value, type)
               {
                 var             ret;
                 var             iterator;

                 switch(type)
                 {
                 case "String":
                   return value ? String(value) : null;

                 case "Date":
                   return value ? Number(value) : null;

                 case "LongString":
                   return (
                     value && value.getValue ? String(value.getValue()) : null);

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
               })(dbResult[fieldName], fields[fieldName]);
          }

          // Save this result
          results.push(result);
        });
      
      // Give 'em the query results!
      return results;
    },


    /**
     * Put an entity to the database. If the key field is null or undefined, a
     * key is automatically generated for the entity.
     *
     * @param entity {liberated.dbif.Entity}
     *   The entity to be made persistent.
     */
    put : function(entity)
    {
      var             dbKey;
      var             dbEntity;
      var             datastoreService;
      var             Datastore;
      var             entityData = entity.getData();
      var             keyProperty = entity.getEntityKeyProperty();
      var             type = entity.getEntityType();
      var             propertyName;
      var             propertyType;
      var             fields;
      var             fieldName;
      var             data;
      var             key;
      var             keyRange;
      var             keyFields = [];
      
      // Gain access to the datastore service
      Datastore = Packages.com.google.appengine.api.datastore;
      datastoreService = 
        Datastore.DatastoreServiceFactory.getDatastoreService();


      // Are we working with a composite key?
      if (qx.lang.Type.getClass(keyProperty) == "Array")
      {
        // Yup. Build the composite key from these fields
        keyProperty.forEach(
          function(fieldName)
          {
            keyFields.push(entityData[fieldName]);
          });
        key = liberated.appengine.Dbif._buildCompositeKey(keyFields);
      }
      else
      {
        // Retrieve the (single field) key
        key = entityData[keyProperty];
      }

      // Ensure that there's either a real key or no key; not empty string
      if (key == "")
      {
        throw new Error("Found disallowed empty key");
      }

      // Get the field names for this entity type
      fields = entity.getDatabaseProperties().fields;

      // If there's no key yet...
      dbKey = null;
      
      // Note: Rhino (and thus App Engine which uses Rhino-compiled code)
      // causes "global" to returned by qx.lang.Type.getClass(key) if key is
      // null or undefined. Without knowing whether it returns "global" in any
      // other case, we test for those two cases explicitly.
      switch(key === null || key === undefined
             ? "Null"
             : qx.lang.Type.getClass(key))
      {
      case "Null":
      case "Undefined":         // Never occurs due to explicit test above
        // Generate a new key. Determine what type of key to use.
        switch(fields[keyProperty])
        {
        case "Key":
        case "Number":
          // Obtain a unique key that no other running instances will obtain.
          keyRange =
            datastoreService.allocateIds(
              liberated.appengine.Dbif.__keyRoot, entity.getEntityType(), 1);
          
          // Get its numeric value
          dbKey = keyRange.getStart();
          key = dbKey.getId();
          break;
          
        case "String":
          // Obtain a unique key that no other running instances will obtain.
          keyRange =
            datastoreService.allocateIds(
              liberated.appengine.Dbif.__keyRoot, entity.getEntityType(), 1);
          
          // Get its numeric value
          dbKey = keyRange.getStart();
          key = dbKey.getName();
          break;
          
        default:
          throw new Error("No way to autogenerate key");
        }
        
        // Save this key in the key field
        entityData[keyProperty] = key;
        break;
        
      case "Number":
        // Save this key in the key field
        entityData[keyProperty] = key;
        break;
        
      case "Array":
        // Build a composite key string from these key values
        key = liberated.appengine.Dbif._buildCompositeKey(key);
        break;
        
      case "String":
        // nothing special to do
        break;
        
      default:
        break;
      }

      // If we didn't auto-generate one, ...
      if (dbKey === null)
      {
        // ... create the database key value
        dbKey =
          Datastore.KeyFactory.createKey(
            liberated.appengine.Dbif.__keyRoot, entity.getEntityType(), key);
      }

      // Create an App Engine entity to store in the database
      dbEntity = new Packages.com.google.appengine.api.datastore.Entity(dbKey);

      // Add each property to the database entity
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

             case "Date":
               // If non-null, convert to a Java Long as with Integer;
               // otherwise return null.
               return value !== null ? java.lang.Long(String(value)) : null;

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
      datastoreService.put(dbEntity);
    },
    

    /**
     * Remove an entity from the database
     *
     * @param entity {liberated.dbif.Entity}
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
      var             dbKey;
      var             datastore;
      var             Datastore;
      
      // Are we working with a composite key?
      if (qx.lang.Type.getClass(keyProperty) == "Array")
      {
        // Yup. Build the composite key from these fields
        keyProperty.forEach(
          function(fieldName)
          {
            keyFields.push(entityData[fieldName]);
          });
        key = liberated.sim.Dbif._buildCompositeKey(keyFields);
      }
      else
      {
        // Retrieve the (single field) key
        key = entityData[keyProperty];
      }

      // Create the database key value
      Datastore = Packages.com.google.appengine.api.datastore;
      dbKey = Datastore.KeyFactory.createKey(
        liberated.appengine.Dbif.__keyRoot, type, key);

      // Remove this entity from the database
      datastore = Datastore.DatastoreServiceFactory.getDatastoreService();
      datastore["delete"](dbKey);
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
      var             key;
      var             file;
      var             fileService;
      var             writeChannel;
      var             printWriter;
      var             segment;
      var             segmentSize;
      var             FileServiceFactory;
      var             Channels;
      var             PrintWriter;
      
      FileServiceFactory = 
        Packages.com.google.appengine.api.files.FileServiceFactory;
      Channels = java.nio.channels.Channels;
      PrintWriter = java.io.PrintWriter;
      
      // Get a file service
      fileService = FileServiceFactory.getFileService();
      
      // Create a new blob file with mime type "text/plain"
      file = fileService.createNewBlobFile("text/plain");
      
      // Open a write channel, with lock=true so we can finalize it
      writeChannel = fileService.openWriteChannel(file, true);
      
      // Get a print writer for this channel, so we can write a string
      printWriter = new PrintWriter(Channels.newWriter(writeChannel, "UTF8"));

      // Write our blob data as a series of 32k writes
      printWriter.write(blobData);
      printWriter.close();
      
      // Finalize the channel
      writeChannel.closeFinally();
      
      // Retrieve the blob key for this file
      key = fileService.getBlobKey(file).getKeyString();
      
      // Give 'em the blob id
      return String(key);
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
      var             blob;
      var             blobstoreService;
      var             blobKey;
      var             blobInfoFactory;
      var             blobInfo;
      var             size;
      var             maxFetchSize;
      var             segmentSize;
      var             startIndex;
      var             endIndex;
      var             BlobstoreService;
      var             BlobstoreServiceFactory;
      var             BlobKey;
      var             BlobInfoFactory;
      
      BlobstoreService =
        Packages.com.google.appengine.api.blobstore.BlobstoreService;
      BlobstoreServiceFactory = 
        Packages.com.google.appengine.api.blobstore.BlobstoreServiceFactory;
      BlobKey =
        Packages.com.google.appengine.api.blobstore.BlobKey;
      BlobInfoFactory = 
        Packages.com.google.appengine.api.blobstore.BlobInfoFactory;
      
      // Get a blobstore service
      blobstoreService = BlobstoreServiceFactory.getBlobstoreService();
      
      // Convert the (string) blobId to a blob key
      blobKey = new BlobKey(blobId);

      // Load the information about this blob
      blobInfoFactory = new BlobInfoFactory();
      blobInfo = blobInfoFactory.loadBlobInfo(blobKey);
      size = blobInfo.getSize();

      // Retrieve the blob
      blob = [];
      maxFetchSize = 1015808;
      startIndex = 0;
      while (size > 0)
      {
        // Determine how much to fetch. Use largest available size within limit.
        segmentSize = Math.min(size, maxFetchSize);
        endIndex = startIndex + segmentSize - 1;

        // Fetch a blob segment and convert it to a Java string.
        blob.push(
          String(
            new java.lang.String(
              blobstoreService.fetchData(blobKey, startIndex, endIndex))));
        
        // Update our start index for next time
        startIndex += segmentSize;

        // We've used up a bunch of the blob. Update remaining size.
        size -= segmentSize;
      }
      
      // Join all of the parts together.
      blob = blob.join("");
      
      // Give 'em what they came for
      return blob;
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
      var             blobstoreService;
      var             blobKey;
      var             BlobstoreServiceFactory;
      var             BlobKey;
      
      BlobstoreServiceFactory = 
        Packages.com.google.appengine.api.blobstore.BlobstoreServiceFactory;
      BlobKey = Packages.com.google.appengine.api.blobstore.BlobKey;
      
      // Get a blobstore service
      blobstoreService = BlobstoreServiceFactory.getBlobstoreService();
      
      // Convert the (string) blobId to a blob key
      blobKey = new BlobKey(blobId);

      // Delete the blob
      blobstoreService["delete"](blobKey);
    },
    
    
    /**
     * Begin a transaction.
     *
     * @return {Object}
     *   A transaction object. It has commit(), rollback(), and isActive() 
     *   methods.
     */
    beginTransaction : function()
    {
      var             datastoreService;
      var             Datastore;

      // Gain access to the datastore service
      Datastore = Packages.com.google.appengine.api.datastore;
      datastoreService = 
        Datastore.DatastoreServiceFactory.getDatastoreService();

      return datastoreService.beginTransaction();
    }
  },

  defer : function()
  {
    var         Sq4java = Packages.com.almworks.sqlite4java;
    var         file;
    
    // Get a handle to the database file
    file = new java.io.File(liberated.jetty.SqliteDbif.__dbName);

    // Open the database
    liberated.jetty.SqliteDbif.__db.open(true);
  }
});
