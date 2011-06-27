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
 * Handler for remote procedure calls.
 */
qx.Class.define("rpcjs.jetty.Rpc",
{
  extend : qx.core.Object,

  construct : function(services, url)
  {
    // Save the services map.
    this.__services = services;
    
    // The url is ignored in this implementation. We only get here if the url
    // is pre-determined to be destined to us.

    // Get an RPC Server instance.
    this.__rpcServer = new rpcjs.rpc.Server(
      qx.lang.Function.bind(this.__serviceFactory, this));
  },
  
  members :
  {
    /** Our instance of the JSON-RPC server */
    __rpcServer : null,
    
    /** The map of services we've been provided */
    __services  : null,
    
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
    __serviceFactory : function(fqMethodName, protocol, error)
    {
      var             method;

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
        method = eval("this.__services" + "." + fqMethodName);
        
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
    },

    
    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param jsonData {String}
     *   The data provide in a POST request
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
