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
@asset(liberated/*)
*/


/**
 * Abstract handler for remote procedure calls.
 */
qx.Class.define("liberated.AbstractRpcHandler",
{
  extend : qx.core.Object,

  /**
   * Base constructor for each RPC handler.
   */
  construct : function()
  {
    var             i;
    var             services = {};
    var             part;

    // Call the superclass constructor
    this.base(arguments);

    // Initialize the services
    liberated.AbstractRpcHandler._services = services;
    
    // Get an RPC Server instance.
    this.__rpcServer = new liberated.rpc.Server(
      liberated.AbstractRpcHandler._serviceFactory);
  },
  
  statics :
  {
    /** The services map */
    _services : null,
    
    /**
     *  Function to call for authorization to run the service method. If
     *  null, no authorization is required. Otherwise this should be a
     *  function which takes as a parameter, the fully-qualified name of the
     *  method to be called, and must return true to allow the function to be
     *  called, or false otherwise, to indicate permission denied.
     */
    authorizationFunction : null,

    /**
     * The service factory takes a method name and attempts to produce a
     * service method that corresponds to that name. This implementation
     * concatenates the method name to the name of the variable holding
     * the service map, and looks for a corresponding method.
     * 
     * @param fqMethodName {String}
     *   The fully-qualified name of the method to be called.
     * 
     * @param protocol {String}
     *   The JSON-RPC protocol being used ("2.0")
     * 
     * @param error {liberated.rpc.error.Error}
     *   An error object to be set if an error is encountered in 
     *   instantiating the requested service method.
     * 
     * @return {Function}
     *   The service method associated with the specified method name.
     */
    _serviceFactory : function(fqMethodName, protocol, error)
    {
      var             method;

      // Append the fully-qualified method name to the services map and
      // evaluate it in hopes of getting a method reference.
      //
      // We have a dot-separated fully-qualified method name. We want to
      // access that entry in the map of maps in _services. Using the
      // index notation won't work, since it's multiple levels deep
      // (i.e. fqMethodName might be something like "a.b.c").
      // 
      // fqMethodName was sanitized by liberated.rpc.Server:processRequest()
      // so this eval is reasonably safe. (I know... Famous last words!)
      method = eval("liberated.AbstractRpcHandler._services" +
                    "." + fqMethodName);

      // We might have just gotten null, which also means no such method
      if (! method)
      {
        // No such method.
        error.setCode(qx.io.remote.RpcError.v2.error.MethodNotFound);
        error.setMessage("No such method");
        return null;
      }

      // Validate allowability of calling this function
      if (liberated.AbstractRpcHandler.authorizationFunction &&
          !liberated.AbstractRpcHandler.authorizationFunction(fqMethodName))
      {
        // Permission denied
        error.setCode(qx.io.remote.RpcError.v2.error.PermissionDenied);
        error.setMessage("Permission denied.");
        return null;
      }
      
      // Give 'em the reference to the method they can call.
      return method;
    },
    
    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The fully-qualified name of this service.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param context {Object}
     *   The context in which the service function should be called
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, context, paramNames)
    {
      var             i;
      var             f;
      var             part;
      var             services = liberated.AbstractRpcHandler._services;
      
      // Split the fully-qualifieid service name into its constituent parts
      serviceName = serviceName.split(".");
      
      // If there was only one part, make it as if there were multiple parts
      if (! qx.lang.Type.isArray(serviceName))
      {
        serviceName = [ serviceName ];
      }

      // Add each of the RPC keys. The final component is the what will be
      // used to save the service function, so is ignored for the moment.
      for (i = 0, part = services;
           i < serviceName.length - 1;
           i++, services = part)
      {
        // Get this part of the service key
        part = services[serviceName[i]];

        // Has this part been defined yet?
        if (! part)
        {
          // Nope. Define it.
          part = services[serviceName[i]] = {};
        }
      }
      
      // Use this object as the context for the service
      f = qx.lang.Function.bind(fService, context);
      
      // Save the parameter names as a property of the function object
      f.parameterNames = paramNames;

      // Save the service function with the final component of the service name
      part[serviceName[i]]  = f;
    },

    
    /**
     * Retrieve the parameter names for a registered service.
     *
     * @param serviceName {String}
     *   The fully-qualified name of this service.
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
      var             i;
      var             part;
      var             services = liberated.AbstractRpcHandler._services;

      // Split the service name into its constituent parts
      // Split the fully-qualifieid service name into its constituent parts
      serviceName = serviceName.split(".");
      
      // If there was only one part, make it as if there were multiple parts
      if (! qx.lang.Type.isArray(serviceName))
      {
        serviceName = [ serviceName ];
      }

      for (i = 0, part = services;
           i < serviceName.length - 1;
           i++, services = part)
      {
        // Get this part of the service key
        part = services[serviceName[i]];

        // Has this part been defined yet?
        if (! part)
        {
          // Nope. 
          return undefined;
        }
      }
      
      // Get the stored service function
      var f = part[serviceName[i]];
      
      if (! qx.lang.Type.isFunction(f))
      {
        // We expected a function but found something else
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
    }
  },
  
  members :
  {
    /**
     * Register a service name and function. This is just a convenience member
     * method that calls the static function of the same name.
     *
     * @param serviceName {String}
     *   The fully-qualified name of this service.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param context {Object}
     *   The context in which the service function should be called
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    registerService : function(serviceName, fService, context, paramNames)
    {
      liberated.AbstractRpcHandler.registerService(serviceName,
                                                   fService,
                                                   context,
                                                   paramNames);
    },

    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param jsonData {String}
     *   The JSON-encoded RPC request to be processed
     * 
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned.
     */
    processRequest : function(jsonData)
    {
      // Call the RPC server to process this request
      return this.__rpcServer.processRequest(jsonData);
    }
  }
});
