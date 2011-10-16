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
#asset(rpcjs/*)
*/


/**
 * Abstract handler for remote procedure calls.
 */
qx.Class.define("rpcjs.AbstractRpcHandler",
{
  extend : qx.core.Object,

  /**
   * Base constructor for each RPC handler.
   *
   * @param rpcKey {Array}
   *   The list of prefix keys for access to the set of remote 
   *   procedure calls supported in this object's services map.
   *
   *   Example: If the passed parameter is [ "sys", "fs" ] and 
   *   one of the methods later added is "read" then the remote
   *   procedure call will be called "sys.fs.read", and the services
   *   map will contain:
   *
   *   {
   *     sys :
   *     {
   *       fs :
   *       {
   *         read : function()
   *         {
   *           // implementation of sys.fs.read()
   *         }
   *       }
   *     }
   *   }
   */
  construct : function(rpcKey)
  {
    var             i;
    var             services = {};
    var             part;

    // Call the superclass constructor
    this.base(arguments);

    // Initialize the services
    rpcjs.AbstractRpcHandler._services = services;
    
    // Add each of the RPC keys
    for (i = 0, part = services; i < rpcKey.length; i++)
    {
      part = part[rpcKey[i]] = {};
    }
    
    // Store the final part, where registered services will go
    rpcjs.AbstractRpcHandler._servicesByKey = part;
    
    // Get an RPC Server instance.
    this.__rpcServer = new rpcjs.rpc.Server(
      rpcjs.AbstractRpcHandler._serviceFactory);
  },
  
  statics :
  {
    /** The services map */
    _services : null,
    
    /** 
     * Reference to the final component of the services map, where registered
     * services are placed.
     */
    _servicesByKey : null,

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
     *   The JSON-RPC protocol being used ("qx1", "2.0")
     * 
     * @param error {rpcjs.rpc.error.Error}
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
      // fqMethodName was sanitized by rpcjs.rpc.Server:processRequest()
      // so this eval is reasonably safe. (I know... Famous last words!)
      method = eval("rpcjs.AbstractRpcHandler._services" +
                    "." + fqMethodName);

      // We might have just gotten null, which also means no such method
      if (! method)
      {
        // No such method.
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.MethodNotFound,
            "2.0" : qx.io.remote.RpcError.v2.error.MethodNotFound
          }[protocol]);
        error.setMessage("No such method");
        return null;
      }

      // Validate allowability of calling this function
      if (rpcjs.AbstractRpcHandler.authorizationFunction &&
          !rpcjs.AbstractRpcHandler.authorizationFunction(fqMethodName))
      {
        // Permission denied
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.PermissionDenied,
            "2.0" : qx.io.remote.RpcError.v2.error.PermissionDenied
          }[protocol]);
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
     *   The name of this service within the <[rpcKey]> namespace.
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
      var             f;
      
      // Use this object as the context for the service
      f = qx.lang.Function.bind(fService, context);
      
      // Save the parameter names as a property of the function object
      f.parameterNames = paramNames;

      // Save the service
      rpcjs.AbstractRpcHandler._servicesByKey[serviceName] = f;
    },

    
    /**
     * Retrieve the parameter names for a registered service.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
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
      var f = rpcjs.AbstractRpcHandler._servicesByKey[serviceName];
      
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
    }
  },
  
  members :
  {
    /**
     * Register a service name and function. This is just a convenience member
     * method that calls the static function of the same name.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
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
      rpcjs.AbstractRpcHandler.registerService(serviceName,
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
