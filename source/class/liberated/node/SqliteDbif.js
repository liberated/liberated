/**
 * Copyright (c) 2014 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("liberated.node.SqliteDbif",
{
  extend  : qx.core.Object,
  type    : "abstract",

  statics :
  {
    /** Name of the Blob table */
    BLOB_TABLE_NAME : "__BLOBS__",

    /** Field name within the Blob table, which contains blob data */
    BLOB_KEY_NAME : "blobId",

    /** Field name within the Blob table, which contains blob data */
    BLOB_FIELD_NAME : "data",

    /** Database handle */
    __db : null,

    /**
     *  Create an "open" function with the standard callback signature
     * 
     * @param dbName {String}
     *   The name of the database to be opened
     * 
     * @param callback {Function}
     *   Callback function. Provided arguments will be err and db handle
     *
     * @ignore(require)
     * @ignore(sqlite3)
     */
    openDatabase : function(dbName, callback)
    {
      var             db;
      var             sqlite3 = require("sqlite3");

      db = new sqlite3.Database(
        dbName,
        function(err)
        {
          if (err) 
          {
            callback(err);
            return;
          }

          // The open succeeded. Give 'em the database handle
          console.log("database " + dbName + " has been opened");
          callback(null, db);
        });
    },

    /**
     *  Create an "insert" function with the standard callback signature
     * 
     * @param db {Object}
     *   The database handle previously returned by openDatabase()
     * 
     * @param sql {String}
     *   SQL statement being prepared for execution
     * 
     * @param params {Array}
     *   Parameters to be bound
     * 
     * @param callback {Function}
     *   Callback function. Provided arguments will be err and last insert rowid
     */
    insert : function(db, sql, params, callback)
    {
      var             statement;

      db.run(
        sql,
        params,
        function(err)
        {
          if (err)
          {
            callback(err);
            return;
          }

          // The prepare succeeded. Give 'em the last insert rowid
          callback(null, this.lastID);
        });
    },

    /**
     * Initialize the database. This opens the database and creates any
     * non-existent tables. It throws an error if any existing tables' schema
     * have changed.
     * 
     * This should not be called until all entity types have registered their
     * property types.
     * 
     * @param databaseName {String}
     *   The name of the database file.
     * 
     * @ignore(require)
     * @ignore(sqlite3)
     * @ignore(sync.*)
     */
    init : function(databaseName)
    {
      var             db;
      var             file;
      var             type;
      var             className;
      var             propertyTypes = liberated.dbif.Entity.propertyTypes;
      var             entityTypeMap = liberated.dbif.Entity.entityTypeMap;
      var             keyField;
      var             field;
      var             fields;
      var             query;
      var             fieldList;
      var             keyList;
      var             preparedQuery;
      var             sync = require("synchronize");
      var             This = liberated.node.SqliteDbif;

      // Save the database name
      This.__databaseName = databaseName;

      sync.fiber(
        function()
        {
          // Gain access to the database
          db = This.__db = 
            sync.await(This.openDatabase(databaseName, sync.defer()));

          // For each entity type...
          for (className in entityTypeMap)
          {
            type = liberated.dbif.Entity.entityTypeMap[className];
            keyField = propertyTypes[type].keyField;
            fields = propertyTypes[type].fields;

            // Generate a query to create the tables if they doesn't exist
            query = [];
            query.push("CREATE TABLE IF NOT EXISTS");
            query.push(type);
            query.push("(");

            // Add each of the fields
            fieldList = [];
            for (field in fields)
            {
              var             fieldData = field + " ";

              switch(fields[field])
              {
              case "String":
              case "LongString":
              case "KeyArray":
              case "StringArray":
              case "LongStringArray":
              case "NumberArray":
              case "BlobId":
                fieldData += "TEXT";
                break;

              case "Date":
              case "Key":
              case "Integer":
                fieldData += "INTEGER";
                break;

              case "Float":
                fieldData += "REAL";
                break;
              }

              // Add this field's data to the list
              fieldList.push(fieldData);
            }

            // Handle the primary key field(s)
            keyList = [];

            // Is the key field an array?
            if (qx.lang.Type.getClass(keyField) == "Array")
            {
              // Yup. Add each of them as an ascending primary key index
              keyField.forEach(
                function(field)
                {
                  keyList.push(field + " ASC");
                });
            }
            else
            {
              keyList.push(keyField + " ASC");
            }

            // Add the primary key list to the list of fields
            fieldList.push("PRIMARY KEY (" + keyList.join(", ") + ")");

            // Add the field list to the query
            query.push(fieldList.join(", "));

            // Create the full query now
            query = query.join(" ") + ");";

            // Issue the query
            sync.await(db.run(query, sync.defer()));
          }

          // Create the Blobs table
          query = [];
          query.push("CREATE TABLE IF NOT EXISTS");
          query.push("\"" + liberated.node.SqliteDbif.BLOB_TABLE_NAME + "\"");
          query.push("(");
          query.push(liberated.node.SqliteDbif.BLOB_KEY_NAME);
          query.push("INTEGER PRIMARY KEY,");
          query.push(liberated.node.SqliteDbif.BLOB_FIELD_NAME);
          query.push("BLOB,");
          query.push("contentType STRING,");
          query.push("filename STRING");
          query.push(");");

          // Create the full query now
          query = query.join(" ");

          // Execute the create table query
          sync.await(db.run(query, sync.defer()));
        });
    },


    /**
     * Query for all entities of a given class/type, given certain criteria.
     *
     * @param classname {String}
     *   The name of the class, descended from liberated.dbif.Entity, of
     *   the object type which is to be queried in the database.
     *
     * @param criteria {Map}
     *   See {@link liberated.dbif.Entity#query} for details.
     *
     * @return {Array}
     *   An array of maps, i.e. native objects (not of Entity objects!)
     *   containing the data resulting from the query.
     */
    query : function(classname, searchCriteria, resultCriteria)
    {
      var             i;
      var             db;
      var             query;
      var             params;
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
      var             sync = require("synchronize");
      var             This = liberated.node.SqliteDbif;
      
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
        query = "SELECT * FROM " + type;
        keyField.forEach(
          function(fieldName, i)
          {
            // If this is the first field specifier...
            if (i == 0)
            {
              query += " WHERE ";
            }
            else
            {
              // Otherwise,  we need a conjunction
              query += " AND ";
            }
            
            // Add a spec for this field and a place holder for its value.
            query += fieldName + " = ?" + i+1;
            
            // Create a parameter entry for this field
            params.push(searchCriteria[i]);
          });
        break;

      case "Number":
      case "String":
        // We've been given a non-composite key
        params = [];
        query = "SELECT * FROM " + type + " WHERE " + keyField + " = ?1";
        params.push(searchCriteria);
        break;

      default:
        // Create a new query
        params = [];
        query = [];
        query.push("SELECT * FROM " + type);

        // If they're not asking for all objects, build a criteria predicate.
        if (searchCriteria)
        {
          query.push(" WHERE ");

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
                  query.push(")");
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
                query.push(criterion.field);
                query.push(filterOp);
                query.push("?" + (params.length + 1));
                params.push(criterion.value);
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
                params.push(criterion.value);
                break;

              case "offset":
                offset = " OFFSET ?" + (params.length + 1);
                params.push(criterion.value);
                break;

              case "sort":
                sort = " ORDER BY ?" + (params.length + 1);
                params.push(criterion.field);
                sort += criterion.order == "desc" ? "DESC" : "ASC";
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
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Execute the query synchronously
      dbResults = sync.await(db.all(query, params, sync.defer()));

      if (typeof dbResults == "undefined")
      {
        dbResults = [];
      }

      // Process the query results
      dbResults.forEach(
        function(dbResult)
        {
          // Initialize a map for the result data
          result = {};

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
                 case "BlobId":
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
                 case "BlobIdArray":
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
      var             db;
      var             key;
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
      var             sync = require("synchronize");
      var             This = liberated.node.SqliteDbif;
      
      // Get the field names for this entity type
      fields = entity.getDatabaseProperties().fields;
      
      //
      // Generate an insertion query
      //
      query = [];
      
      // Prologue
      query.push("INSERT OR REPLACE INTO");
      query.push(type);

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
        if (i != 1)
        {
          query.push(",");
        }
        query.push("?" + i++);
        
        switch(fields[fieldName])
        {
        case "KeyArray":
        case "StringArray":
        case "LongStringArray":
        case "NumberArray":
        case "BlobIdArray":
          params.push(qx.lang.Json.stringify(entityData[fieldName]));
          break;
          
        default :
          params.push(entityData[fieldName]);
          break;
        }
      }

      query.push(");");

      // Create the full query now
      query = query.join(" ");

      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Execute the query synchronously
      key = sync.await(This.insert(db, query, params, sync.defer()));

      // If the key value is auto-generated...
      if (keyProperty == "uid" ||
          (qx.lang.Type.getClass(keyProperty) != "Array" &&
           entityData[keyProperty] === null))
      {
        entityData[keyProperty] = key;
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
      var             db;
      var             entityData = entity.getData();
      var             keyProperty = entity.getEntityKeyProperty();
      var             type = entity.getEntityType();
      var             propertyName;
      var             query;
      var             params;
      var             preparedQuery;
      var             sync = require("synchronize");
      
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
            query.push(fieldName);
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

      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the remove query
      sync.await(db.run(query, params, sync.defer()));
    },
    
    /**
     * Add a blob to the database.
     *
     * @param blobData {LongString}
     *   The data to be written as a blob
     *
     * @param contentType {String?}
     *   The content type value. Defaults to "text/plain"
     *
     * @param filename {String?}
     *   The filename for this blob.
     *
     * @return {String}
     *   The blob ID of the just-added blob
     * 
     * @throws {Error}
     *   If an error occurs while writing the blob to the database, an Error
     *   is thrown.
     */
    putBlob : function(blobData, contentType, filename)
    {
      var             db;
      var             query;
      var             params;
      var             preparedQuery;
      var             key;
      var             sync = require("synchronize");
      var             This = liberated.node.SqliteDbif;
      
      // If no content type is specified...
      if (! contentType)
      {
        // ... then default it
        contentType = "text/plain";
      }
      
      // if no filename is specified...
      if (typeof filename == "undefined")
      {
        // ... then use null.
        filename = null;
      }

      // Generate the insertion query
      query =
        [
          "INSERT INTO",
          liberated.node.SqliteDbif.BLOB_TABLE_NAME,
          "VALUES (?1, ?2, ?3);"
        ].join(" ");
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Create the parameter array
      params = [ blobData, contentType, filename ];

      // Insert the row
      key = sync.await(This.insert(db, query, params, sync.defer()));

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
      var             db;
      var             query;
      var             preparedQuery;
      var             blob;
      var             sync = require("synchronize");
      
      // Generate the insertion query
      query =
        [
          "SELECT",
          liberated.node.SqliteDbif.BLOB_FIELD_NAME,
          "FROM",
          liberated.node.SqliteDbif.BLOB_TABLE_NAME,
          "WHERE",
          liberated.node.SqliteDbif.BLOB_KEY_NAME,
          "= ?1;"
        ].join(" ");
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      blob = sync.await(db.get(query, [ blobId ], sync.defer()));
      
      // Give 'em what they came for
      return blob[liberated.node.SqliteDbif.BLOB_FIELD_NAME];
    },
    
    /**
     * Retrieve the extra blob info (content type and filename) from the
     * database
     *
     * @param blobId {Key}
     *   The blob ID of the blob to be retrieved
     * 
     * @return {Map}
     *   A map containing two fields: contentType and filename.
     */
    getBlobInfo : function(blobId)
    {
      var             db;
      var             query;
      var             blobInfo;
      var             retval = {};
      var             sync = require("synchronize");
      
      // Generate the insertion query
      query =
        [
          "SELECT contentType, filename",
          "FROM",
          liberated.node.SqliteDbif.BLOB_TABLE_NAME,
          "WHERE",
          liberated.node.SqliteDbif.BLOB_KEY_NAME,
          "= ?1;"
        ].join(" ");
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      blobInfo = sync.await(db.get(query, [ blobId ], sync.defer()));
      
      // Give 'em what they came for
      return blobInfo;
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
      var             db;
      var             query;
      var             preparedQuery;
      var             key;
      var             sync = require("synchronize");
      
      // Generate the insertion query
      query =
        [
          "DELETE FROM",
          liberated.node.SqliteDbif.BLOB_TABLE_NAME,
          "WHERE",
          liberated.node.SqliteDbif.BLOB_FIELD_NAME,
          "= ?1;"
        ].join(" ");
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      sync.await(db.run(query, [ blobId ], sync.defer()));
    },
    
    
    /**
     * Begin a transaction.
     *
     * @return {Object}
     *   A transaction object. It has commit() and rollback() methods.
     */
    beginTransaction : function()
    {
      var             db;
      var             query;
      var             preparedQuery;
      var             sync = require("synchronize");

      // Generate the BEGIN TRANSACTION query
      query = "BEGIN;";
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      sync.await(db.run(query, sync.defer()));

      return (
        {
          commit   : liberated.node.SqliteDbif.__commitTransaction,
          rollback : liberated.node.SqliteDbif.__rollbackTransaction
        });
    },
    
    /**
     * Commit an open transaction
     */
    __commitTransaction : function()
    {
      var             db;
      var             query;
      var             preparedQuery;
      var             sync = require("synchronize");

      // Generate the COMMIT TRANSACTION query
      query = "COMMIT;";
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      sync.await(db.run(query, sync.defer()));
    },
    
    /**
     * Roll back an open transaction
     */
    __rollbackTransaction : function()
    {
      var             db;
      var             query;
      var             preparedQuery;
      var             sync = require("synchronize");

      // Generate the ROLLBACK TRANSACTION query
      query = "ROLLBACK;";
      
      // Retrieve the database connection
      db = liberated.node.SqliteDbif.__db;

      // Issue the query
      sync.await(db.run(query, sync.defer()));
    }
  }
});
