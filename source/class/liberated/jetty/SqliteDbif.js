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
    /** Name of the Blob table */
    BLOB_TABLE_NAME : "__BLOBS__",

    /** Field name within the Blob table, which contains blob data */
    BLOB_FIELD_NAME : "data",

    /** Name of the database file */
    __dbName        : null,
    
    /** Handle to the open database */
    __db            : null,

    /** Whether a transaction is in progress */
    __bTransactionInProgress : false,
    
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
            query += fieldName + " = ?" + i+1;
            
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
        query = "SELECT * FROM " + type + " WHERE " + keyField + " = ?1";
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
                  query.push("?" + (params.length + 1));
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
                limit = " LIMIT ?" + (params.length + 1);
                params.push(
                  {
                    value : criterion.value,
                    type  : "Integer"
                  });
                break;

              case "offset":
                offset = " OFFSET ?" + (params.length + 1);
                params.push(
                  {
                    value : criterion.value,
                    type  : "Integer"
                  });
                break;

              case "sort":
                sort =
                  " ORDER BY ?" + (criterion.field + 1) + " " + criterion.order;
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
            preparedQuery.bind(i+1, param.value);
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
        // Clean up
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
                 case "LongString":
                   return value ? String(value) : null;

                 case "Date":
                   return value ? Number(value) : null;

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
                     // On the assumption that these arrays are maintained
                     // only for "smaller" data, they are stored as JSON and
                     // parsed here.
                     return qx.lang.Json.parse(value);
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
      var             i;
      var             entityData = entity.getData();
      var             keyProperty = entity.getEntityKeyProperty();
      var             type = entity.getEntityType();
      var             propertyName;
      var             propertyType;
      var             fields;
      var             fieldName;
      var             fieldNames;
      var             query;
      var             params;
      var             preparedQuery;
      
      // Get the field names for this entity type
      fields = entity.getDatabaseProperties().fields;
      
      //
      // Generate an insertion query
      //
      query = [];
      
      // Prologue
      query.push("INSERT OR REPLACE INTO");
      query.push("type");

      // Field list
      query.push("(");
      fieldNames = [];
      for (fieldName in fields)
      {
        fieldNames.push(fieldName);
      }
      query.push(fieldNames.join(","));
      query.push(")");

      // Value list (to be bound)
      query.push("VALUES(");
      i = 1;
      params = [];
      for (fieldName in fields)
      {
        query.push("?" + i++);
        params.push(entityData[fieldName]);
      }
      query.push(");");

      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query.join(" "));
      try
      {
        // Bind the parameters
        params.forEach(
          function(param, i)
          {
            preparedQuery.bind(i+1, param.value);
          });
        
        // Execute the insertion query
        preparedQuery.step();
        
        // If the key is auto-generated...
        if (keyProperty == "uid")
        {
          // ... then retrieve the key value and add it to the entity
          entityData[fieldName] =
            liberated.jetty.SqliteDbif.__db.getLastInsertId();
        }
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }
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
      var             query;
      var             params;
      var             preparedQuery;
      
      query = [];
      query.push("DELETE FROM");
      query.push(type);
      query.push(" WHERE ");

      // Are we working with a composite key?
      if (qx.lang.Type.getClass(keyProperty) == "Array")
      {
        // Yup. Build the composite key from these fields
        keyProperty.forEach(
          function(fieldName, i)
          {
            if (i > 0)
            {
              query.push("AND");
            }
            query.push(fieldname);
            query.push("= ?" + (i + 1));
            params.push(entityData[fieldName]);
          });
      }
      else
      {
        // Retrieve the (single field) key
        query.push(keyProperty);
        query.push("= ?1");
        params.push(entityData[keyProperty]);
      }

      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query.join(" "));
      try
      {
        // Bind the parameters
        params.forEach(
          function(param, i)
          {
            preparedQuery.bind(i+1, param.value);
          });
        
        // Execute the insertion query
        preparedQuery.step();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
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
      var             query;
      var             preparedQuery;
      var             key;
      
      // Generate the insertion query
      query =
        [
          "INSERT INTO",
          liberated.jetty.SqliteDbif.BLOB_TABLE_NAME,
          "VALUES (?1);"
        ].join(" ");
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Bind the data to the query
        preparedQuery.bind(1, blobData);
        
        // Execute the insertion query
        preparedQuery.step();
        
        // Retrieve the key value and add it to the entity
        key = liberated.jetty.SqliteDbif.__db.getLastInsertId();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }

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
      var             query;
      var             preparedQuery;
      var             blob;
      
      // Generate the insertion query
      query =
        [
          "SELECT * FROM",
          liberated.jetty.SqliteDbif.BLOB_TABLE_NAME,
          "WHERE",
          liberated.jetty.SqliteDbif.BLOB_FIELD_NAME,
          "= ?1;"
        ].join(" ");
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Bind the blob id to the query
        preparedQuery.bind(1, blobId);
        
        // Execute the insertion query
        preparedQuery.step();
        
        // Retrieve the blob data
        blob = columnValue(0);
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }
      
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
      var             query;
      var             preparedQuery;
      var             key;
      
      // Generate the insertion query
      query =
        [
          "DELETE FROM",
          liberated.jetty.SqliteDbif.BLOB_TABLE_NAME,
          liberated.jetty.SqliteDbif.BLOB_FIELD_NAME,
          "= ?1;"
        ].join(" ");
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Bind the data to the query
        preparedQuery.bind(1, blobData);
        
        // Execute the insertion query
        preparedQuery.step();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }
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
      var             query;
      var             preparedQuery;

      // Generate the insertion query
      query = "BEGIN;";
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Execute the insertion query
        preparedQuery.step();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }

      // A transaction is now in progress
      liberated.jetty.SqliteDbif.__bTransactionInProgress = true;

      return (
        {
          commit   : this.__commitTransaction,
          rollback : this.__rollbackTransaction,
          isActive : this.__isActive
        });
    },
    
    /**
     * Commit an open transaction
     */
    __commitTransaction : function()
    {
      var             query;
      var             preparedQuery;

      // Generate the insertion query
      query = "COMMIT;";
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Execute the insertion query
        preparedQuery.step();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }

      // The transaction is no longer in progress
      liberated.jetty.SqliteDbif.__bTransactionInProgress = false;
    },
    
    /**
     * Roll back an open transaction
     */
    __rollbackTransaction : function()
    {
      var             query;
      var             preparedQuery;

      // Generate the insertion query
      query = "ROLLBACK;";
      
      // Prepare and issue a query
      preparedQuery = liberated.jetty.SqliteDbif.__db.prepare(query);
      try
      {
        // Execute the insertion query
        preparedQuery.step();
      }
      finally
      {
        // Clean up
        preparedQuery.dispose();
      }

      // The transaction is no longer in progress
      liberated.jetty.SqliteDbif.__bTransactionInProgress = false;
    },
    
    /**
     * Determine if there is an open transaction
     * 
     * @return {Boolean}
     *   <i>true</i> if there is a transaction in progress;
     *   <i>false</i> otherwise
     */
    __isActive : function()
    {
      // A transaction is now in progress
      return liberated.jetty.SqliteDbif.__bTransactionInProgress;
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
