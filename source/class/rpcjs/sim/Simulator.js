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
#use(rpcjs.sim.remote.Transport)
*/


/**
 * The main simulator class.
 */
qx.Class.define("rpcjs.sim.Simulator",
{
  statics :
  {
    /** TimerManager singleton */
    __timerManager :  null,

    /** Place to put requests as they are posted, while awaiting processing */
    __requestQueue : [],

    /** List of handlers. Each will be tried in order of registration. */
    __handlers     : [],

    /**
     * Whether to process requests synchronously, or to better simulate a real
     * transport by processing requests asynchronously. The former allows
     * easier debugging.
     */
    SYNCHRONOUS : true,

    /**
     * Register a handler for a particular URL.
     *
     * @param handler {Function}
     *   The function which is called to process a request with the given
     *   URL. The function will be called with the request object and a
     *   responseHeaders map which is initialized to contain a status of 200
     *   (success) and an empty statusText string. The function should return
     *   the result of the request upon success. Upon failure, it should
     *   modify the two response header fields, and return null.
     */
    registerHandler : function(handler)
    {
      rpcjs.sim.Simulator.__handlers.push(handler);
    },
    

    /**
     * Function called by the simulation transport to enqueue a new request.
     *
     * @param request {Map}
     *   A map containing the data pertaining to the request. The map will
     *   have the following members:
     *
     *     url             {String}
     *     method          {String}   GET, POST, etc.
     *     asynchronous    {Boolean}  should always be true, for now
     *     username        {String}
     *     password        {String}
     *     parameters      {Map}
     *     formFields      {Map}
     *     requestHeaders  {Map}
     *     data            {Any}
     */
    post : function(request)
    {
      // Get the request queue
      var             Simulator = rpcjs.sim.Simulator;
      var             requestQueue = Simulator.__requestQueue;

      // Enqueue this request
      requestQueue.push(request);
      
      // Are we processing requests synchronously?
      if (Simulator.SYNCHRONOUS)
      {
        Simulator.__processQueue();
      }
      else
      {
        // If this is the first item on the queue...
        if (requestQueue.length == 1)
        {
          // ... then start a timer to process the queue immediately
          Simulator.__timerManager.start(Simulator.__processQueue,
                                         0, window, null, 0);
        }
      }
    },


    /**
     * Process an element from the queue. After processing it, if the queue is
     * not empty, set a timer to be re-called immediately.
     */
    __processQueue : function()
    {
      var             i;
      var             request;
      var             response;
      var             responseHeaders;
      var             transportPost;
      var             Simulator = rpcjs.sim.Simulator;
      var             requestQueue = Simulator.__requestQueue;

      // Is there anything on the request queue?
      if (requestQueue.length == 0)
      {
        // Nope. Nothing to do. (Should never occur.)
        return;
      }
      
      // Pull the first element off of the queue
      request = requestQueue.shift();
      
      // Save the transport's post method, and delete it from the request
      transportPost = request.post;
      delete request.post;

      // Try each handler until we find one that handles this request
      for (i = 0; i < Simulator.__handlers.length; i++)
      {
        // Assume that the handler will not be able to process the request
        responseHeaders =
          {
            status     : 501,
            statusText : "Not supported by this handler"
          };
        // Call the handler's processRequest function.
        response = Simulator.__handlers[i](request, responseHeaders);
        
        // Restore the transport's post method to the request object
        request.post = transportPost;

        // See what the handler did with this request.
        // status=200 means it handled the request successfully
        // status=501 means we need to try another handler;
        // anything else means it handled the request but an error occurred
        if (responseHeaders.status == 200)
        {
          // Yes it did! Send the response
          request.post(response, responseHeaders);
          break;
        }
        else if (responseHeaders.status == 501)
        {
          // Try the next handler. Nothing to do here.
        }
        else
        {
          // The request got handled, but was not successful
          request.post(null, responseHeaders);
          break;
        }
      }

      // If we reached the end of the handler list...
      if (i == Simulator.__handlers.length)
      {
        // ... then generate a response indicating there was no handler
        responseHeaders =
          {
            status     : 404,
            statusText : "No handler for URL " + request.url
          };
        request.post(null, responseHeaders);
      }
      
      // Is there anything left on the queue?
      if (requestQueue.length > 0)
      {
        // Yup. Start a timer to process the queue again immediately
        Simulator.__timerManager.start(Simulator.__processQueue,
                                       0, window, null, 0);
      }
    }
  },
  
  defer : function()
  {
    rpcjs.sim.Simulator.__timerManager = qx.util.TimerManager.getInstance();
  }
});
