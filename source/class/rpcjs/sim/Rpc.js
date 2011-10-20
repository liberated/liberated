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

  /**
   * Constructor for this RPC handler.
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
   * 
   * @param url {String}
   *   The URL that must match for this service provider to be used
   */
  construct : function(rpckey, url)
  {
    // Call the superclass constructor
    this.base(arguments, rpckey);

    // Save the URL
    this.setUrl(url);

    // Register ourself with the simulation transport, as a handler 
    // for the specified URL.
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
        // We don't support this one. Response header status was preset.
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
      // sends back an error response).
      responseHeaders.status = 200;
      responseHeaders.statusText = "";

      // Call the RPC server to process this request
      result = this.processRequest(jsonData);
      return result;
    }
  }
});
