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
qx.Class.define("rpcjs.sim.handler.Rpc",
{
  construct : function(url, services)
  {
    // Save the services map.
    this.__services = services;
    
    // Get an RPC Server instance.
    this.__rpcServer = new rpcjs.rpc.Server(this.__serviceFactory);

    // Register ourself as a handler for the specified URL.
    rpcjs.sim.Simulator.registerHandler(url, this.__processRequest);
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
        method = eval("this.__services" + "." + fqMethodName);
      }
      catch(e)
      {
        // No such method.
        if (protocol == "qx1")
        {
          error.setCode(rpcjs.rpc.error.ServerCode.qx1.MethodNotFound);
        }
        else
        {
          error.setCode(rpcjs.rpc.error.ServerCode.v2.MethodNotFound);
        }
        return null;
      }
      
      // Give 'em the reference to the method they can call.
      return method;
    },

    
    /**
     * Process an incoming request which is presumably a JSON-RPC request.
     * 
     * @param request {Map}
     *   A map of data for this request. See {@link rpcjs.sim.Simulator#post}
     *   for details.
     * 
     * @responseHeaders {Map}
     *   A map containing, initially, two members: status {Number} and
     *   statusText {String}. Upon error, this function may alter these two
     *   values.
     * 
     * @return {String}
     *   Upon success, the JSON-encoded result of the RPC request is returned.
     *   Otherwise, null is returned, and responseHeaders are updated to
     *   indicate the source of the error.
     */
    __processRequest : function(request, responseHeaders)
    {
      var             jsonData;
      var             result;
      
      // For the moment, we support only POST
      if (request.method != "POST")
      {
        responseHeaders.status = 405;
        responseHeaders.statusText = 
          "Method " + request.method + " not allowed.";
        return null;
      }
      
      // Retrieve the JSON-RPC data
      jsonData = request.data;
      
      // Call the RPC server to process this request
      result = this.__rpcServer.processRequest(jsonData);
      return result;
    }
  }
});
