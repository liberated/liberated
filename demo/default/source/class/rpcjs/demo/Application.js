/*
 * Copyright:
 *   2011 Derrell Lipman
 *
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html
 *   EPL: http://www.eclipse.org/org/documents/epl-v10.php
 *   See the LICENSE file in the project's top-level directory for details.
 *
 * Authors:
 *   * Derrell Lipman (derrell)
 */

/*
#asset(rpcjs/demo/*)
*/

qx.Class.define("rpcjs.demo.Application",
{
  extend : qx.application.Standalone,


  members :
  {
    services : 
    {
      qooxdoo :
      {
        test :
        {
          echo : function(s)
          {
            return s;
          }
        }
      }
    },

    main : function()
    {
      // Call super class
      this.base(arguments);

      // Enable logging in debug variant
      if (qx.core.Environment.get("qx.debug"))
      {
        var appender;

        // support native logging capabilities, e.g. Firebug for Firefox
        appender = qx.log.appender.Native;

        // support additional cross-browser console. Press F7 to toggle
        // visibility
        appender = qx.log.appender.Console;
      }

      // Create a button
      var button = new qx.ui.form.Button("Get value", "rpcjs/test.png");

      // Document is the application root
      var doc = this.getRoot();
			
      // Add button to document at fixed coordinates
      doc.add(button, {left: 100, top: 50});

      // Add a text box in which the result will be displayed
      var text = new qx.ui.form.TextField();
      doc.add(text, { left : 100, top : 100});

      // Put our RPC simulator on the job!
      var rpcSim = new rpcjs.sim.Rpc(this.services, "/rpc");
      
      // Add an event listener
      button.addListener(
        "execute", 
        function(e)
        {
          // Get an RPC object
          var rpc = new qx.io.remote.Rpc();
          rpc.setUrl("/rpc");
          rpc.setServiceName("qooxdoo.test");
          rpc.setTimeout(30000);

          var _this = this;
          this.rpcRunning = rpc.callAsync(
            function(result, ex, id)
            {
              _this.rpcRunning = null;
              if (ex == null) 
              {
                text.setValue(result);
              }
              else 
              {
                alert("Async(" + id + ") exception: " + ex);
              }
            },
            "echo",
            "hello world");
        });

    }
  }
});
