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
 * Unit tests for the simulation database interface
 */
qx.Class.define("rpcjs.test.DbifSimTest",
{
  extend : qx.dev.unit.TestCase,

  construct : function()
  {
    this.base(arguments);

    this.params = {};

    // Register our RPC services
    this.params["subtract"] = [ "minuend", "subtrahend" ];
    this.registerService("subtract",
                         this.subtract,
                         this.params["subtract"]);
    
    this.params["sum"] = [ ];
    this.registerService("sum",
                         this.sum,
                         this.params["sum"]);
    
    this.params["update"] = [ "p1", "p2", "p3", "p4", "p5" ];
    this.registerService("update",
                         this.update,
                         this.params["update"]);
    
    this.params["hello"] = [ "p1" ];
    this.registerService("hello",
                         this.hello,
                         this.params["hello"]);
    
    this.params["get_data"] = [ ];
    this.registerService("get_data",
                         this.get_data,
                         this.params["get_data"]);

    // Start up our RPC server
    this.__server = new rpcjs.rpc.Server(
      qx.lang.Function.bind(this._serviceFactory, this));
  },

  members :
  {
    /** Map of parameter name lists */
    params : null,

    /** The services map, containing each of the available RPC services */
    __services : {},

    /** The instantiated RPC server */
    __server : null,

    /** Test getServiceParamNames */
    "test: getServiceParamNames" : function()
    {
      // For each function we're testing...
      qx.lang.Object.getKeys(this.params).forEach(
        function(funcName)
        {
          console.log("Checking function name " + funcName);

          // Get the expected and retrieved parameter name arrays
          var expected = this.params[funcName];
          var got = this.getServiceParamNames(funcName);

          // Their lengths must be the same
          this.assertEquals(expected.length, got.length, funcName);
          
          // For each expected parameter name...
          expected.forEach(
            function(paramName, i)
            {
              // ... assert that it matches its peer in the retrieved list
              console.log("Checking param name " + paramName);
              this.assertEquals(paramName, got[i], funcName + ": " + paramName);
            },
            this);
        },
        this);
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
      return this.__services[methodName];
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

    /**
     * Retrieve the parameter names for a registered service.
     *
     * @param serviceName {String}
     *   The name of this service within the <rpcKey>.features namespace.
     *
     * @return {Array|null|undefined}
     *   If the specified service exists and parameter names have been
     *   provided for it, then an array of parameter names is returned.
     *
     *   If the service exists but no parameter names were provided in the
     *   registration of the service, null is returned.
     *
     *   If the service does not exist, undefined is returned.
     */
    getServiceParamNames : function(serviceName)
    {
      // Get the stored service function
      var f = this.__services[serviceName];
      
      // Did we find it?
      if (! f)
      {
        // No, it is not a registered function.
        return undefined;
      }
      
      // Were parameter names registered with the function?
      if (f.parameterNames)
      {
        // Yup. Return a copy of the parameter name array
        return qx.lang.Array.clone(f.parameterNames);
      }
      
      // The function was registered, but not its parameter names.
      return null;
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
