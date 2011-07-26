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


/**
 * Unit tests for the RpcJs JSON-RPC Server
 */
qx.Class.define("rpcjs.test.ServerTest",
{
  extend : qx.dev.unit.TestCase,

  construct : function()
  {
    this.base(arguments);

    // Register our RPC services
    this.registerService("subtract",
                         this.subtract,
                         [ "minuend", "subtrahend" ]);
    this.registerService("sum",
                         this.sum,
                         [ ]);
    this.registerService("update",
                         this.update,
                         [ "p1", "p2", "p3", "p4", "p5" ]);
    this.registerService("hello",
                         this.hello,
                         [ "p1" ] );
    this.registerService("get_data",
                         this.get_data,
                         [ ] );

    // Start up our RPC server
    this.__server = new rpcjs.rpc.Server(
      qx.lang.Function.bind(this._serviceFactory, this));
  },

  members :
  {
    /** The services map, containing each of the available RPC services */
    __services : {},

    /** The instantiated RPC server */
    __server : null,

    /** Array of requests to be tested */
    _tests :
    [
      {
        name :
          'v2: Positional parameters: subtract, initial order of params',
        request :
          '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}',
        responses : 
        {
          "jsonrpc": "2.0",
          "result": 19,
          "id": 1
        }
      },
      
      {
        name :
          'v2: Positional parameters: subtract, reversed order of params',
        
        request :
          '{"jsonrpc": "2.0", "method": "subtract", "params": [23, 42], "id": 2}',
        
        responses :
        {
          "jsonrpc": "2.0",
          "result": -19,
          "id": 2
        }
      },
      
      {
        name :
          'v2: Named parameters: subtract, initial order of params',
        
        request :
          '{"jsonrpc": "2.0", "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3}',
        
        responses :
        {
          "jsonrpc": "2.0",
          "result": 19,
          "id": 3
        }
      },
      
      {
        name :
          'v2: Named parameters: subtract, reversed order of params',
        
        request :
          '{"jsonrpc": "2.0", "method": "subtract", "params": {"minuend": 42, "subtrahend": 23}, "id": 4}',
        
        responses :
        {
          "jsonrpc": "2.0",
          "result": 19,
          "id": 4
        }
      },
      
      {
        name :
          'v2: Notification with existing method',
        
        request :
          '{"jsonrpc": "2.0", "method": "update", "params": [1,2,3,4,5]}'
      },
      
      {
        name :
          'v2: Notification with non-existent method',
        
        request :
          '{"jsonrpc": "2.0", "method": "foobar"}'
      },
      
      {
        name :
          'v2: Call of non-existent method',
        
        request :
          '{"jsonrpc": "2.0", "method": "foobar", "id": "1"}',
        
        responses :
        {
          "jsonrpc": "2.0",
          "error":
          {
            "code" : -32601
          },
          "id": "1"
        }
      },
      
      {
        name :
          'v2: Invalid JSON',
        
        request :
          '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]',
        
        responses :
        {
          "jsonrpc": "2.0",
          "error":
          {
            "code" : -32700
          },
          "id": null
        }
      },
      
      {
        name :
          'v2: Invalid Request object',
        
        request :
          '{"jsonrpc": "2.0", "method": 1, "params": "bar"}',
        
        responses :
        {
          "jsonrpc": "2.0",
          "error":
          {
            "code" : -32600
          },
          "id": null
        }
      },
      
      {
        name :
          'v2: Batch with invalid JSON',
        
        request :
          '[ {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},{"jsonrpc": "2.0", "method" ]',
        
        responses :
        {
          "jsonrpc": "2.0",
          "error":
          {
            "code" : -32700
          },
          "id": null
        }
      },
      
      {
        name :
          'v2: empty Batch array',
        
        request :
          '[]',
        
        responses :
        {
          "jsonrpc": "2.0",
          "error":
          {
            "code" : -32600
          },
          "id": null
        }
      },
      
      {
        name :
          'v2: Invalid non-empty batch of one',
        
        request :
          '[1]',
        
        responses :
        [
          {
            "jsonrpc": "2.0",
            "error":
            {
              "code" : -32600
            },
            "id": null
          }
        ]
      },
      
      {
        name :
          'v2: Invalid non-empty batch of three',
        
        request :
          '[1,2,3]',
        
        responses :
        [
          {
            "jsonrpc": "2.0",
            "error":
            {
              "code" : -32600
            },
            "id": null
          },
          {
            "jsonrpc": "2.0",
            "error":
            {
              "code" : -32600
            },
            "id": null
          },
          {
            "jsonrpc": "2.0",
            "error":
            {
              "code" : -32600
            },
            "id": null
          }
        ]
      },
      
      {
        name :
          'v2: Batch with mixed success and error',
        
        request :
          '[' +
          '  {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},' +
          '  {"jsonrpc": "2.0", "method": "hello", "params": [7]},' +
          '  {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},' +
          '  {"foo": "boo"},' +
          '  {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},' +
          '  {"jsonrpc": "2.0", "method": "get_data", "id": "9"}' +
          ']',
        
        responses :
          [
            {"jsonrpc": "2.0", "result": 7, "id": "1"},
            {"jsonrpc": "2.0", "result": 19, "id": "2"},
            {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request."}, "id": null},
            {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found."}, "id": "5"},
            {"jsonrpc": "2.0", "result": ["hello", 5], "id": "9"}
          ]
      },
      
      {
        name :
          'v2: Batch with all notifications',
        
        request :
          '[' +
          '  {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4]},' +
          '  {"jsonrpc": "2.0", "method": "hello", "params": [7]}' +
          ']'
      }
    ],

    validateResponseObject : function(test, response, index, got, expected)
    {
      var             expectedResponse;
      var             expectedKeys;
      var             gotKeys;
      var             idMsg;
      var             field;
      
      // Get the expected response, if it's one from a batch
      expectedResponse = (index < 0 ? test.responses : test.responses[index]);

      idMsg = 
        ". " + "Expected " + expected + "; Got " + got +
        (index < 0 ? "" : " (index " + index + ")");
      
      // Validate that we got the expected keys in the response
      expectedKeys = qx.lang.Object.getKeys(expectedResponse).sort();
      gotKeys = qx.lang.Object.getKeys(response).sort();
      this.assertArrayEquals(expectedKeys, gotKeys, "Differing keys" + idMsg);
      
      // Validate the individual field data
      this.assertIdentical(expectedResponse.jsonrpc,
                           response.jsonrpc,
                           "jsonrpc field mismatch" + idMsg);
      this.assertIdentical(expectedResponse.id,
                           response.id,
                           "id field mismatch" + idMsg);

      if (typeof(expectedResponse.result) !== "undefined")
      {
        // It's a successful response
        this.assertJsonEquals(expectedResponse.result, response.result);
      }
      else
      {
        // It's an error response. Only test the error code.
        this.assertObject(response.error, "Missing error object");
        this.assertIdentical(expectedResponse.error.code,
                             response.error.code,
                             "Mismatched error code" + idMsg);
      }
    },

    /** Test all requests */
    testAll : function()
    {
      this._tests.forEach(
        function(test)
        {
          var             jsonResponse;
          var             responses;
          var             expected = qx.lang.Json.stringify(test.responses);

          // Display the test name
          qx.Bootstrap.info(test.name);
          
          // Pass this request to the server
          jsonResponse = this.__server.processRequest(test.request);
          
          // We got back a JSON response. Parse it.
          responses = qx.lang.Json.parse(jsonResponse);
          
          // Validate the response type
          if (typeof test.responses == "undefined")
          {
            this.assertNull(responses, 
                            "Expected null response. " +
                            "Expected " + expected + "; " +
                            "Got " + jsonResponse);
          }
          else if (qx.lang.Type.isArray(test.responses))
          {
            this.assertArray(responses, "Expected array response");
            test.responses.forEach(
              function(response, i)
              {
                this.validateResponseObject(test, response, i,
                                            jsonResponse, expected);
              },
              this);
          }
          else
          {
            this.assertObject(responses, "Expected object response");
            this.validateResponseObject(test, responses, -1,
                                        jsonResponse, expected);
          }
        },
        this);
      this.assertEquals(4, 3+1, "This should never fail!");
      this.assertFalse(false, "Can false be true?!");
    },
    
    /**
     * The service factory takes a method name and attempts to produce a
     * service method that corresponds to that name.
     * 
     * @param methodName {String}
     *   The name of the method to be called.
     * 
     * @param protocol {String}
     *   The JSON-RPC protocol being used ("qx1", "1.0", "2.0")
     * 
     * @param error {rpcjs.rpc.error.Error}
     *   An error object to be set if an error is encountered in instantiating
     *   the requested serviced method.
     * 
     * @return {Function}
     *   The service method associated with the specified method name.
     */
    _serviceFactory : function(methodName, protocol, error)
    {
      var f = this.__services[methodName];

      if (! f)
      {
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.MethodNotFound,
            "2.0" : qx.io.remote.RpcError.v2.error.MethodNotFound
          }[protocol]);
      }
      
      return f;
    },

    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <rpcKey>.features namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, paramNames)
    {
      var             f;
      
      // Use this object as the context for the service
      f = qx.lang.Function.bind(fService, this);
      
      // Save the parameter names as a property of the function object
      f.parameterNames = paramNames;

      // Save the service
      this.__services[serviceName] = f;
    },

    subtract : function(minuend, subtrahend)
    {
      return minuend - subtrahend;
    },
    
    sum : function()
    {
      var sum = 0;
      qx.lang.Array.fromArguments(arguments).forEach(
        function(arg)
        {
          sum += arg;
        });
      return sum;
    },

    update : function(p1, p2, p3, p4, p5)
    {
      return true;
    },
    
    hello : function(p1)
    {
    },
    
    get_data : function()
    {
      return [ "hello", 5 ];
    }
  }
});
