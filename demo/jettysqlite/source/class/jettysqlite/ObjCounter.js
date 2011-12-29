/**
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("jettysqlite.ObjCounter",
{
  extend : liberated.dbif.Entity,
  
  construct : function(id)
  {
    // Pre-initialize the data
    this.setData(
      {
        "id"        : null,
        "count"     : 0
      });

    // Call the superclass constructor
    this.base(arguments, "counter", id);
  },
  
  defer : function(clazz)
  {
    liberated.dbif.Entity.registerEntityType(clazz.classname, "counter");

    var databaseProperties =
      {
        /** Id of this counter */
        "id"    : "String",
        
        /** Current counter value */
        "count" : "Integer"
      };

    // Register our property types
    liberated.dbif.Entity.registerPropertyTypes("counter",
                                                databaseProperties,
                                                "id");
  }
});
