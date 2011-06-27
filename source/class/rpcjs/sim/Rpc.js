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
qx.Class.define("rpcjs.sim.Rpc",
{
  extend : rpcjs.AbstractRpcHandler,

  construct : function(services, url)
  {
    // Call the superclass constructor
    this.base(arguments, services);

    // Save the URL
    this.setUrl(url);


    // Register ourself as a handler for the specified URL.
    rpcjs.sim.Simulator.registerHandler(
      qx.lang.Function.bind(this.__processRequest, this));
  },
  
  properties :
  {
    /** The URL which gains access to these RPC services */
    url :
    {
      check    : "String",
      nullable : false
    }
  },

  members :
  {
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
      
      // Make sure we can handle this request
      if (request.url != this.getUrl())
      {
        // We don't support this one. Response header status was preset for us.
        return null;
      }

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
      
      // From here on out, we'll have a successful result (even if the RPC
      // sends back an error ressponse).
      responseHeaders.status = 200;
      responseHeaders.statusText = "";

      // Call the RPC server to process this request
      result = this._rpcServer.processRequest(jsonData);
      return result;
    }
  }
});
