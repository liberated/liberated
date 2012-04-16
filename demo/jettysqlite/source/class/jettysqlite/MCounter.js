/**
 * Copyright (c) 2011 Reed Spool
 *
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html
 *   EPL : http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Mixin.define("jettysqlite.MCounter",
{
  construct : function()
  {

    this.registerService("countPlusOne",
                         this.countPlusOne,
                         [ "counterId" ]);
  },

  members :
  {
    /**
     *  Add one to a counter
     *
     * @param counter {Integer}
     *   This is  the id of the counter which is being incremented
     *
     * @return {Integer}
     *   The resultant value (after incrementing)
     *
     */
    countPlusOne : function(counter, error)
    {
      var            counterObj;
      var            counterDataObj;

      liberated.dbif.Entity.asTransaction(
        function()
        {
          // Get the counter object
          counterObj = new jettysqlite.ObjCounter(counter);

          // Get the application data
          counterDataObj = counterObj.getData();

          // Increment the count
          counterDataObj.count++;
          
          // Write it back to the database
          counterObj.put();
        },
        [],
        this);

      // Return new counter value
      return counterDataObj.count;
    }
  }
});
