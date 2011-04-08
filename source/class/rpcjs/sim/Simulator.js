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

    /** Map of URL -> handlers */
    __handlers     : {},


    /**
     * Register a handler for a particular URL.
     *
     * @param url {String}
     *   The URL which is used to request services of the specified handler.
     *
     * @param handler {Function}
     *   The function which is called to process a request with the given
     *   URL. The function will be called with the request object and a
     *   responseHeaders map which is initialized to contain a status of 200
     *   (success) and an empty statusText string. The function should return
     *   the result of the request upon success. Upon failure, it should
     *   modify the two response header fields, and return null.
     */
    registerHandler : function(url, handler)
    {
      rpcjs.sim.Simulator.__handlers[url] = handler;
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
      
      // If this is the first item on the queue...
      if (requestQueue.length == 1)
      {
        // ... then start a timer to process the queue immediately
        Simulator.__timerManager.start(Simulator.__processQueue,
                                       0, window, null, 0);
      }
    },


    /**
     * Process an element from the queue. After processing it, if the queue is
     * not empty, set a timer to be re-called immediately.
     */
    __processQueue : function()
    {
      var             request;
      var             handler;
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
      
      // Do we have a handler for this URL?
      handler = Simulator.__handlers[request.url];
      if (! handler)
      {
        // Nope. Generate a response.
        responseHeaders =
          {
            status     : 404,
            statusText : "No handler for URL " + request.url
          };
        request.post(null, responseHeaders);
      }
      else
      {
        // We have a handler. Let it handle this request. Initialize for a
        // success response.
        responseHeaders =
          {
            status     : 200,
            statusText : ""
          };

        // Save the transport's post method, and delete it from the request
        transportPost = request.post;
        delete request.post;

        // Call the handler's processRequest function.
        response = handler(request, responseHeaders);
        
        // Restore the post function to the request object.
        request.post = transportPost;

        // Call the transport's post function to give 'em the response.
        request.post(response, responseHeaders);
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
    rpcjs.sim.Simulator.__timer = qx.util.TimerManager.getInstance();
  }
});
