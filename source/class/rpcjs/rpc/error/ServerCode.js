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
 * Server-generated error codes
 */
qx.Class.define("rpcjs.rpc.error.ServerCode",
{
  extend : qx.core.Object,

  statics :
  {
    /** Error codes for qooxdoo's modified Version 1 JSON-RPC */
    qx1 :
    {
      /*
       * Error code, value -1: Script Error
       *
       * This error is raised when the service method aborts with an error,
       * either syntax (parsing) errors or runtime exceptions.
       */
      ScriptError           : -1,

      /**
       * Error code, value 0: Unknown Error
       *
       * The default error code, used only when no specific error code is
       * passed to the Error constructor.  This code should generally not be
       * used for server-generated errors.
       */
      Unknown               : 0,

      /**
       * Error code, value 1: Illegal Service
       *
       * The service name contains illegal characters or is otherwise deemed
       * unacceptable to the JSON-RPC server.
       */
      IllegalService        : 1,

      /**
       * Error code, value 2: Service Not Found
       *
       * The requested service does not exist at the JSON-RPC server.
       */
      ServiceNotFound       : 2,

      /**
       * Error code, value 3: Class Not Found
       *
       * If the JSON-RPC server divides service methods into subsets
       * (classes), this indicates that the specified class was not found.
       * This is slightly more detailed than "Method Not Found", but that
       * error would always also be legal (and true) whenever this one is
       * returned.
       */
      ClassNotFound         : 3,

      /**
       * Error code, value 4: Method Not Found
       *
       * The method specified in the request is not found in the requested
       * service.
       */
      MethodNotFound        : 4,

      /**
       * Error code, value 5: Parameter Mismatch
       *
       * If a method discovers that the parameters (arguments) provided to it
       * do not match the requisite types for the method's parameters, it
       * should return this error code to indicate so to the caller.
       */
      ParameterMismatch     : 5,

      /**
       * Error code, value 6: Permission Denied
       *
       * A JSON-RPC service provider can require authentication, and that
       * authentication can be implemented such that the method takes
       * authentication parameters, or such that a method or class of methods
       * requires prior authentication.  If the caller has not properly
       * authenticated to use the requested method, this error code is
       * returned.
       */
      PermissionDenied      : 6
    },
    
    v2 :
    {
      /**
       * Invalid JSON was received by the server.
       * An error occurred on the server while parsing the JSON text.
       */
      ParseError            : -32700,
      
      /** The JSON sent is not a valid Request object */
      InvalidRequest        : -32600,
      
      /** The method does not exist or is not available */
      MethodNotFound        : -32601,
      
      /** Invalid method parameter(s) */
      InvalidParams         : -32602,
      
      /** An internal JSON-RPC server error occurred */
      InternalError         : -32603
      
      /*
       *  -32099 to -32000 are reserved as implementation-defined server errors
       */
    }
  }
});
