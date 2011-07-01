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
 * JSON-RPC server
 */
qx.Class.define("rpcjs.rpc.Server",
{
  extend : qx.core.Object,

  
  /**
   * Constructor for a JSON_RPC server.
   *
   * @param serviceFactory {Function}
   *   A function which provides an interface to a service method. The
   *   function will be called with a namespaced method name, and an
   *   rpcjs.rpc.error.Error object. Under normal circumstances (success), it
   *   should return a function reference. If the method identified by name is
   *   not available, either because it does not exist, or for some other
   *   reason (e.g. the function's was called in a cross-domain fashion but
   *   the function is not permitted to be used in that fashion), the provided
   *   error object's methods should be used to provide details of the error,
   *   and then the error object should be returned.
   */
  construct : function(serviceFactory)
  {
    // Call the superclass constructor
    this.base(arguments);

    // The service factory is mandatory
    if (! qx.lang.Type.isFunction(serviceFactory))
    {
      throw new Error("Missing service factory function");
    }
    
    // Save the parameters for future use
    this.setServiceFactory(serviceFactory);
  },
  
  properties :
  {
    /**
     * A function which provides an interface to a service method. The
     * function will be called with a namespaced method name, and an
     * rpcjs.rpc.error.Error object. Under normal circumstances (success), it
     * should return a function reference. If the method identified by name is
     * not available, either because it does not exist, or for some other
     * reason (e.g. the function's was called in a cross-domain fashion but
     * the function is not permitted to be used in that fashion), the provided
     * error object's methods should be used to provide details of the error,
     * and then the error object should be returned.
     */
    serviceFactory :
    {
      check    : "Function"
    }
  },

  members :
  {
    /**
     * Process a single remote procedure call request.
     *
     * @param jsonInput {String}
     *   The input string, containing the JSON-encoded RPC request.
     *
     * @return {String}
     *   The JSON response.
     */
    processRequest : function(jsonInput)
    {
      var             request;  // the parsed input request
      var             error;    // an error object
      var             reply;    // a textual reply in case garbage input
      var             protocol; // protocol version being used
      var             fqMethod; // fully-qualified method name
      var             service;  // service function to call
      var             result;   // result of calling service function
      
      try
      {
        // Parse the JSON
        request = qx.lang.Json.parse(jsonInput);
      }
      catch(e)
      {
        // We couldn't parse the request. Send back text, not JSON.
        reply = "JSON-RPC request expected; could not parse request.";
        return reply;
      }

      // Ensure we got a valid object or array
      if (typeof(request) != "object")
      {
        // Invalid. Send back text, not JSON.
        reply = "JSON-RPC request expected; got non-object/array.";
        return reply;
      }

      // Determine which protocol to use. Is there a jsonrpc member?
      if (typeof(request.jsonrpc) == "string")
      {
        // Yup. It had better be "2.0"!
        if (request.jsonrpc != "2.0")
        {
          // Get a new version 2.0 error object.
          error = new rpcjs.rpc.error.Error("2.0");
          error.setCode(qx.io.remote.RpcError.v2.error.InvalidRequest);
          error.setMessage("'jsonrpc' member must be \"2.0\".");
          error.setData("Found value " + request.jsonrpc + "in 'jsonrpc'.");

          // Give 'em the error.
          return error.stringify();
        }
        else
        {
          protocol = "2.0";

          // Get a new version 2.0 error object.
          error = new rpcjs.rpc.error.Error("2.0");
        }
      }
      else
      {
        protocol = "qx1";

        // Ensure all of the required members are present in the request
        if (! qx.lang.Type.isString(request.service) ||
            ! qx.lang.Type.isString(request.method) ||
            ! qx.lang.Type.isArray(request.params))
        {
          // Invalid. Send back text, not JSON.
          reply =
            "JSON-RPC request expected; " +
            "service, method, or params missing.";
          return reply;
        }

        // Get a qooxdoo-modified version 1 error object
        error = new rpcjs.rpc.error.Error("qx1");
      }

      // Generate the fully-qualified method name
      fqMethod = request.service + "." + request.method;

      /*
       * Ensure the requested method name is kosher.  It should be:
       *
       *   First test for:
       *   - a dot-separated sequences of strings
       *   - first character of each string is in [a-zA-Z] 
       *   - other characters are in [_a-zA-Z0-9]
       *
       *   Then verify:
       *   - no two adjacent dots
       */

      // First test for valid characters
      if (! /^[a-zA-Z][_.a-zA-Z0-9]*$/.test(fqMethod))
      {
        // There's some illegal character in the service or method name
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.MethodNotFound,
            "2.0" : qx.io.remote.RpcError.v2.error.MethodNotFound
          }[protocol]);
        error.setMessage("Illegal character found in service name.");
        return error.stringify();
      }

      // Next, ensure there are no double dots
      if (request.service.indexOf("..") != -1)
      {
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.MethodNotFound,
            "2.0" : qx.io.remote.RpcError.v2.error.MethodNotFound
          }[protocol]);
        error.setMessage("Illegal use of two consecutive dots " +
                         "in service name.");
        return error.stringify();
      }
      
      // Use the registered callback to get a service function associated with
      // this method name.
      service = this.getServiceFactory()(fqMethod, protocol, error);
      
      // Was there an error?
      if (service == null)
      {
        // Yup. Give 'em the error.
        // The error class knows how to stringify itself, but we need a map.
        // Go both directions, to obtain the map.
        error = qx.lang.Json.parse(error.stringify());
        
        // Build the error response
        return qx.lang.Json.stringify(
          {
            id    : request.id,
            error : error
          });
      }
      
        
      if (protocol == "qx1")
      {
        // Future errors are almost certainly of Application origin
        error.setOrigin(qx.io.remote.RpcError.qx1.origin.Application);
      }

      // We should now have a service function to call. Call it.
      try
      {
        request.params.push(error); // provide error object as last param
        result = service.apply(window, request.params);
      }
      catch(e)
      {
        // The service method threw an error. Create our own error from it.
        error.setCode(
          {
            "qx1" : qx.io.remote.RpcError.qx1.error.server.ScriptError,
            "2.0" : qx.io.remote.RpcError.v2.error.InternalError
          }[protocol]);

        // Combine the message from the original error
        error.setMessage("Method threw an error: " + e);
        
        // This is classified as a server error, not application-origin.
        if (protocol == "qx1")
        {
          error.setOrigin(qx.io.remote.RpcError.qx1.origin.Server);
        }
        
        // Use this error as the result
        result = error;
      }
      
      // Was the result an error?
      if (result instanceof rpcjs.rpc.error.Error)
      {
        // Yup. Stringify and return it.
        // The error class knows how to stringify itself, but we need a map.
        // Go both directions, to obtain the map.
        error = qx.lang.Json.parse(result.stringify());
        
        // Build the error response
        return qx.lang.Json.stringify(
          {
            id    : request.id,
            error : error
          });
      }

      // We have a standard result. Stringify and return a proper response.
      return qx.lang.Json.stringify(
        {
          id     : request.id,
          result : result
        });
    }
  }
});
