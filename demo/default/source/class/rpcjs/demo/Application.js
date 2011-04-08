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
      var button = new qx.ui.form.Button("Run Tests", "rpcjs/test.png");

      // Document is the application root
      var doc = this.getRoot();
			
      // Add button to document at fixed coordinates
      doc.add(button, {left: 100, top: 50});

      // Whether to use the simple test or the complete RPC test suite
      this.bSimple = true;

      if (this.bSimple)
      {
        // Add a text box in which the result will be displayed
        var text = new qx.ui.form.TextField();
        doc.add(text, { left : 100, top : 100});
      }
      else
      {
        var label = new qx.ui.basic.Label(
          "<h3>" +
          "RPC results are displayed in the log. " +
          "Expect two 'Server error 23' alerts." +
          "</h3>");
        label.setRich(true);
        doc.add(label, { left : 100, top : 100});
      }

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

          if (this.bSimple)
          {
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
          }
          else
          {
            this.rpcServerFunctionalityAsync(rpc);
          }

        },
        this);

    },
    
    /** Service methods */
    services : 
    {
      /** The standard qooxdoo test methods */
      qooxdoo :
      {
        test :
        {
          // Echo the parameter
          echo : function(s)
          {
            return s;
          },
          
          // Get an integer value
          getInteger : function()
          {
            return 1;
          },
          
          // Return a floating point value
          getFloat : function()
          {
            return 1/3;
          },
          
          // Return a string
          getString : function()
          {
            return "Hello world";
          },
          
          // Return a bad string
          getBadString : function()
          {
            return "<!DOCTYPE HTML \"-//IETF//DTD HTML 2.0//EN\">";
          },
          
          // Return an array of integers
          getArrayInteger : function()
          {
            return [ 1, 2, 3, 4 ];
          },
          
          // Return an array of strings
          getArrayString : function()
          {
            return [ "one", "two", "three", "four" ];
          },
          
          // Return some arbitrary object
          getObject : function()
          {
            return { x : 23, y : 42 };
          },
          
          // Return true
          getTrue : function()
          {
            return true;
          },
          
          // Return false
          getFalse : function()
          {
            return false;
          },
          
          // Return null
          getNull : function()
          {
            return null;
          },
          
          // Determine if the parameter is an integer
          isInteger : function(val)
          {
            return (qx.lang.Type.isNumber(val) &&
                    parseInt(val) == val &&
                    parseInt(val).toString().length == val.toString().length);
          },
          
          // Determine if the parameter is a floating point number.
          // Any number will do.
          isFloat : qx.lang.Type.isNumber,
          
          // Determine if the parameter is a string.
          isString : qx.lang.Type.isString,
          
          // Determine if the parameter is a boolean.
          isBoolean : function(val)
          {
            return val !== null && val instanceof Boolean;
          },
          
          // Determine if the parameter is an array
          isArray : qx.lang.Type.isArray,
          
          // Determine if the parameter is an object
          isObject : qx.lang.Type.isObject,
          
          // Determine if the parameter is null
          isNull : function(val)
          {
            return val === null;
          },
          
          // Return all of the parameters
          getParams : function()
          {
            return qx.lang.Array.fromArguments(arguments);
          },
          
          // Return the first parameter
          getParam : function(val)
          {
            return val;
          },
          
          // Get the current time, in both seconds since epoch and map formats
          getCurrentTimestamp : function()
          {
            var t = new Date();
            var o = 
              {
                now  : t.getTime() / 1000,
                json : 
                {
                  year : t.getUTCFullYear(),
                  month : t.getUTCMonth(),
                  day : t.getUTCDate(),
                  hour : t.getUTCHours(),
                  minute : t.getUTCMinutes(),
                  second : t.getUTCSeconds(),
                  millisecond : t.getUTCMilliseconds()
                }
              };
            return o;
          },
          
          // Return an RPC error
          getError : function()
          {
            var error = new rpcjs.rpc.error.Error("qx1");
            error.setCode(23);
            error.setMessage("This is an application-provided error");
            return error;
          }
        }
      }
    },

    rpcServerFunctionalityAsync : function(rpc)
    {
      var             obj;
      var             date;
      var             dataArray;
      var             test;
      var             mycall;
      var             testNum;

      /*
       * Create an array of each of the tests.  Each array element is itself
       * an array of two function: the first to issue the test request, and
       * the second to validate the result.
       */
      var tests =
        [
          [
            function()
            {
              test = "getCurrentTimestamp";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: now=" + result.now);
              this.warn("result: jsonDate=" + result.json.toString());
            }
          ],

          [
            function()
            {
              test = "getInteger";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns a number, got " + typeof(result) + ": " +
                        (typeof(result) == "number" &&
                         isFinite(result) ? "true" : "false"));
            }
          ],

          [
            function()
            {
              test = "isInteger";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, 1);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an integer: " + result);
            }
          ],

          [
            function()
            {
              test = "getString";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns a string: " + (typeof(result) == "string"));
            }
          ],

          [
            function()
            {
              test = "isString";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, "Hello World");
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns a string: " + result);
            }
          ],

          [
            function()
            {
              test = "getNull";
              this.warn("Calling '" + test + "'");
              var mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns null: " +
                        (typeof(result) == "object" &&
                         mycall === null ? "true" : "false"));
            }
          ],

          [
            function()
            {
              test = "isNull";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, null);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns null: " + result);
            }
          ],

          [
            function()
            {
              test = "getArrayInteger";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an array: " +
                        ((typeof(result) == "object") &&
                         (result instanceof Array)));
            }
          ],

          [
            function()
            {
              test = "getArrayString";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an array: " +
                        ((typeof(result) == "object") &&
                         (result instanceof Array)));
            }
          ],

          [
            function()
            {
              dataArray = new Array(5);

              for (var i=0; i<5; i++)
              {
                dataArray[i] = i;
              };

              test = "isArray";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, dataArray);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an array: " + result);
            }
          ],

          [
            function()
            {
              dataArray = new Array(5);

              for (var i=0; i<5; i++)
              {
                dataArray[i] = "Element " + i;
              };

              test = "isArray";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, dataArray);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an array: " + result);
            }
          ],

          [
            function()
            {
              test = "getFloat";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns a float: " + (typeof(result) == "number"));
            }
          ],

          [
            function()
            {
              test = "getObject";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns an object: " +
                        (typeof(result) == "object"));
            }
          ],

          [
            function()
            {
              test = "isObject";
              this.warn("Calling '" + test + "'");
              obj = new Object();
              obj.s = "Hi there.";
              obj.n = 23;
              obj.o = new Object();
              obj.o.s = "This is a test.";
              mycall = rpc.callAsync(handler, test, obj);
            },

            function(result)
            {
              this.warn("result: {" + result.toString() + "}");
              this.warn("Returns an object: " + result);
            }
          ],

          [
            function()
            {
              test = "isBoolean";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, false);
            },

            function(result)
            {
              this.warn("result: {" + result.toString() + "}");
              this.warn("Returns a boolean: " + result);
            }
          ],

          [
            function()
            {
              test = "isBoolean";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, true);
            },

            function(result)
            {
              this.warn("result: {" + result.toString() + "}");
              this.warn("Returns a boolean: " +  result);
            }
          ],

          [
            function()
            {
              test = "getTrue";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result.toString() + "}");
              this.warn("Returns a boolean = true: " +
                        (typeof(result) == "boolean"));
            }
          ],

          [
            function()
            {
              test = "getFalse";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              this.warn("result: {" + result.toString() + "}");
              this.warn("Returns a boolean = false: " +
                        (typeof(result) == "boolean"));
            }
          ],

          [
            function()
            {
              Date.prototype.classname = "Date";
              date = new Date();
              test = "getParam";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler, test, date);
            }

/*
            function(result)
            {
              this.warn("result: {" + result + "}");
              this.warn("Returns a date object, got " +
                        (result.classname == date.classname));
              this.warn("Returns matching time " + date.getTime() + " = " +
                        result.getTime() + " :" +
                        (result.getTime() == date.getTime()));
            }
*/
          ],

          [
            function()
            {
              dataArray = new Array();
              dataArray[0] = true;
              dataArray[1] = false;
              dataArray[2] = 1;
              dataArray[3] = 1.1;
              dataArray[4] = "Hello World";
              dataArray[5] = new Array(5);
              dataArray[6] = new Object();

              test = "getParams";
              this.warn("Calling '" + test + "'");
              mycall = rpc.callAsync(handler,
                                     test,
                                     dataArray[0],
                                     dataArray[1],
                                     dataArray[2],
                                     dataArray[3],
                                     dataArray[4],
                                     dataArray[5],
                                     dataArray[6]);
            },

            function(result)
            {
              this.warn("result: {" + result + "}");

              for (var i=0; i< dataArray.length; i++)
              {
                this.warn("Returned parameter (" + i + ") value '" +
                          result[i] + "' matches '" + dataArray[i] + "': " +
                          (result[i].toString() == dataArray[i].toString()));
                this.warn("Returned parameter (" + i + ") type '" +
                          typeof(result[i]) + "' matches '" +
                          typeof(dataArray[i]) + "': " +
                          (typeof(result[i]) == typeof(dataArray[i])));
              };
            }
          ],

          [
            function()
            {
              test = "getError";
              this.warn("Calling '" + test + " (method 1)'");
              mycall = rpc.callAsync(handler, test);
            },

            function(result)
            {
              // should never get here; we should receive an exception
              this.warn("ERROR: Should have received an exception!  " +
                        "Got: " + result);
            }
          ],

          [
            function()
            {
              test = "getError";
              this.warn("Calling '" + test +
                        " (method 2 -- only differs with PHP backend)'");
              mycall = rpc.callAsync(handler, test, true);
            },

            function(result)
            {
              // should never get here; we should receive an exception
              this.warn("ERROR: Should have received an exception!  " +
                        "Got: " + result);
            }
          ]
        ];

      /*
       * This is the generic handler, used by each of the tests.  It
       * ascertains whether an exception occured and alert()s with the
       * exception if so; otherwise it calls the result validation function
       * and then starts the next test.
       */
      var handler = qx.lang.Function.bind(
        function(result, ex, id) 
        {
          mycall = null;
          if (ex !== null)
          {
            alert("Async(" + id + ") exception: " + ex);
          }
          else
          {
            // display results of the completed test. [][1] = validate response
            if (tests[testNum][1])
            {
              qx.lang.Function.bind(tests[testNum][1], this)(result); 
            }
          }

          // start the next test
          ++testNum;

          // Are we done?
          if (testNum < tests.length) {
            // Nope.  Run the next test.
            qx.lang.Function.bind(tests[testNum][0], this)();
          }
        },
        this);

      // start the first test
      testNum = 0;
      qx.lang.Function.bind(tests[testNum][0], this)();    // [][0] = request
    }
  }
});
