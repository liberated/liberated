/*
 * Service registration
 * 
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL: http://www.eclipse.org/org/documents/epl-v10.php
 */

/* The actual services to be registered are loaded at the end. */

(function()
 {
   var             __services = 
     {
       robot :
       {
         finch :
         {
         }
       }
     };
   
   /**
    * Register a service name and function.
    *
    * @param serviceName {String}
    *   The name of this service within the <rpcKey>.features namespace.
    *
    * @param fService {Function}
    *   The function which implements the given service name.
    * 
    * @param paramNames {Array}
    *   The names of the formal parameters, in order.
    */
   registerService = function(finch, serviceName, fService, paramNames)
   {
     var             f;

     // Use the Finch object as the context for the service
     f = qx.lang.Function.bind(fService, finch);

     // Save the parameter names as a property of the function object
     f.parameterNames = paramNames;

     // Save the service
     __services.robot.finch[serviceName] = f;
   };

   /**
    * Return the services map
    */
   getServices = function()
   {
     return __services;
   };
 })();

// Load the actual service methods we'll be using
load("Finch.js");
