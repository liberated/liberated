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

  construct : function(services)
  {
    // Save the services map.
    rpcjs.AbstractRpcHandler._services = services;
    
    // Get an RPC Server instance.
    this._rpcServer = new rpcjs.rpc.Server(
      rpcjs.AbstractRpcHandler._serviceFactory);
  },
  
  statics :
  {
    /** The services map */
    _services : null,

    /**
     *  Function to call for authentication to run the service method. If
     *  null, no authentication is required. Otherwise this should be a
     *  function which takes as a parameter, the fully-qualified name of the
     *  method to be called, and must return true to allow the function to be
     *  called, or false otherwise, to indicate permission denied.
     */
    _authenticationFunction : null,

    /**
     * The service factory takes a method name and attempts to produce a
     * service method that corresponds to that name. In this implementation,
     * it concatenates the method name to the name of the variable holding the
     * service map, and looks for corresponding method.
     * 
     * @param fqMethodName {String}
     *   The fully-qualified name of the method to be called.
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
    _serviceFactory : function(fqMethodName, protocol, error)
    {
      var             method;

      // Validate allowability of calling this function
      if (rpcjs.AbstractRpcHandler._authenticationFunction &&
          !rpcjs.AbstractRpcHandler._authenticationFunction(fqMethodName))
      {
        // No such method.
        if (protocol == "qx1")
        {
          error.setCode(
            qx.io.remote.RpcError.qx1.error.server.PermissionDenied);
        }
        else
        {
          error.setCode(qx.io.remote.RpcError.v2.error.PermissionDenied);
        }
        error.setMessage("Permission denied.");
        return null;
      }

      // Append the fully-qualified method name to the services map and
      // evaluate it in hopes of getting a method reference.
      try
      {
        // We have a dot-separated fully-qualified method name. We want to
        // access that entry in the map of maps in this.__services. Using the
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
          throw new Error("No such method");
        }
      }
      catch(e)
      {
        // No such method.
        if (protocol == "qx1")
        {
          error.setCode(qx.io.remote.RpcError.qx1.error.server.MethodNotFound);
        }
        else
        {
          error.setCode(qx.io.remote.RpcError.v2.error.MethodNotFound);
        }
        error.setMessage(e.message);
        return null;
      }
      
      // Give 'em the reference to the method they can call.
      return method;
    }
  }
});
