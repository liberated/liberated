importPackage(Packages.org.eclipse.jetty.server);
importPackage(Packages.org.eclipse.jetty.server.handler);
importPackage(Packages.javax.servlet.http);

load("build/script/qxlib-noopt.js");

(function()
 {
   var             rpc;

   /**
    * Process a POST request. These are the standard GUI-initiated remote
    * procedure calls.
    *
    * @param request {Packages.javax.servlet.http.HttpServletRequest}
    *   The object containing the request parameters.
    *
    * @param response {Packages.javax.servlet.http.HttpServletResponse}
    *   The object to be used for returning the response.
    */
   function doPost(request, response)
   {
     var             dbif;
     var             rpcResult;
     var             out;
     var             reader;
     var             line;
     var             input = [];
     var             jsonInput;

     // Retrieve the JSON input from the POST request. First, get the input
     // stream (the POST data)
     reader = request.getReader();

     // Read the request data, line by line.
     for (line = reader.readLine(); line != null; line = reader.readLine())
     {
       input.push(String(line));
     }

     // Convert the input lines to a single string
     jsonInput = String(input.join("\n"));

     // Process this request
     rpcResult = rpc.processRequest(jsonInput);

     // Generate the response.
     response.setContentType("application/json");
     out = response.getWriter();
     out.println(rpcResult);
   };


   /**
    * Process a GET request. These are used for ancillary requests.
    *
    * @param request {Packages.javax.servlet.http.HttpServletRequest}
    *   The object containing the request parameters.
    *
    * @param response {Packages.javax.servlet.http.HttpServletResponse}
    *   The object to be used for returning the response.
    */
   function doGet(request, response)
   {
     var             out;
     var             queryString = request.getQueryString();

     // Echo the query string, but decode it.
     response.setContentType("application/json");
     out = response.getWriter();
     out.println(decodeURIComponent(queryString));
   }


   /**
    * Given a Javascript array of objects return a Java array of objects of
    * the given type.  This is used to create Java arrays to send to the
    * Jetty API.
    *
    * @param type {Packages.*}
    *   The Java class of the array being created
    *
    * @param objects {Array}
    *   The JavaScript array being converted to a Java array
    *
    * @return {java.lang.Array}
    *   The Java array which is a copy of provided the JavaScript array
    */
   function toJArray(type, objects) 
   {
     var jarray = java.lang.reflect.Array.newInstance(type, objects.length);

     for (var i = 0; i < objects.length; ++i) 
     {
       jarray[i] = objects[i];
     }

    return jarray;
   };


   // -------------------------------------------------------------------------
   // Main
   //-------------------------------------------------------------------------

   // Create a Jetty server instance
   var server = new Server(3000);

   //
   // Static File Handler
   //
        
   // Create a resource handler to deal with static file requests
   var resourceHandler = new ResourceHandler();

   // If a request on the root path is received, serve a default file.
   resourceHandler.setWelcomeFiles(toJArray(java.lang.String,
                                            [ "index.html" ]));

   // Serve files from our build directory (for now)
   resourceHandler.setResourceBase("./build");

   //
   // Remote Procedure Call handler
   //

   // Instantiate a new handler to handle RPCs
   var rpcHandler = new JavaAdapter(
     AbstractHandler, 
     {
       handle: function(target, baseRequest, request, response) 
       {
         var             f;
         var             bIsRpc;

         // Is this a remote procedure call request?
         bIsRpc =
           target == "/rpc" ||
           (target.length >= 5 &&
            (target.substring(0, 5) == "/rpc?" &&
             target.substring(0, 5) == "/rpc/"));

         if (! bIsRpc)
         {
           // Nope. Let someone else handle it.
           return;
         }

         // Determine the request method. We currently support POST and GET.
         if (request.getMethod().equals("POST"))
         {
           f = doPost;
         }
         else if (request.getMethod().equals("GET"))
         {
           f = doGet;
         }
         else
         {
           print("Unexpected RPC data (not POST or GET)");
           return;
         }

         // Call the appropriate function
         f(request, response);

         // We've handled this request
         baseRequest.setHandled(true);
       }
     });

   //
   // We have multiple handlers, so we need a handler collection
   //

   // Instantiate a handler collection
   var handlers = new HandlerCollection();

   // Add the two handlers. The RPC handler comes first. If it can't
   // handle the request, then the resource handler will be called.
   handlers.setHandlers(toJArray(Handler, [ rpcHandler, resourceHandler ]));

   // Now we can set the handlers for our server
   server.setHandler(handlers);

   // Retrieve our services table
   load("services.js");
   var services = getServices();

   // Initialize the remote procedure call server itself
   rpc = new rpcjs.jetty.Rpc(services, "/rpc");

   // Start up the server. We're ready to go!
   server.start();
   server.join();
 })();
