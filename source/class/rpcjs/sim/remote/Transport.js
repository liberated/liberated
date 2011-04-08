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
 * Transports requests to a simulated server
 *
 * This class should not be used directly by client programmers.
 */
qx.Class.define("rpcjs.sim.remote.Transport",
{
  extend : qx.io.remote.transport.Abstract,

  construct : function()
  {
    // Call the superclass constructor
    this.base(arguments);
    
    // Initialize response headers
    this.__responseHeaders = {};
  },

  statics :
  {
    /**
     * Capabilities of this transport type.
     */
    handles :
    {
      simulate              : true, // This is our unique capability
      synchronous           : true,
      asynchronous          : true,
      crossDomain           : true,
      fileUpload            : false,
      programaticFormFields : true,
      responseTypes         : 
        [ 
          "text/plain",
          "text/javascript", 
          "application/json",
          "application/xml",
          "text/html"
        ]
    },


    /**
     * Whether the current browser supports this transport
     * 
     * @return
     *   true, always. This transport is supported by all browsers.
     */
    isSupported : function() 
    {
      return true;
    }
  },

  members :
  {
    __request         : null,
    __responseData    : null,
    __responseHeaders : null,

    // overridden
    send : function()
    {
      // The request data, as retrieved from the various properties
      this.__request =
        {
          url             : this.getUrl(),
          method          : this.getMethod(),
          asynchronous    : this.getAsynchronous(),
          username        : this.getUsername(),
          password        : this.getPassword(),
          parameters      : this.getParameters(),
          formFields      : this.getFormFields(),
          requestHeaders  : this.getRequestHeaders(),
          data            : this.getData(),
          
          // Function to post the response. The siguature is:
          //   post(responseData, responseHeaders);
          post            : qx.lang.Function.bind(this.post, this)
        };

      // Initialize responses data and headers
      this.__responseData = null;
      this.__responseHeaders = {};

      // Simulate initial states
      this.setState("created");
      this.setState("configured");

      // Post this request to the simulator's request queue
      rpcjs.sim.Simulator.post(this.__request);
      
      // Simulate sending state, how that we've "initiated" sending to our
      // peer. (In reality, it's already arrived.)
      this.setState("sending");
    },

    /**
     * A response to a previously-issued request is posted via a call to this
     * function.
     *
     * @param responseData {Any}
     *   The data that is returned as a result of the previously-issued request
     *
     * @param responseHeaders {Map|null}
     *   If response headers are returned, they will be in a map provided
     *   here. Otherwise, this parameter will be either null or undefined.
     */
    post : function(responseData, responseHeaders)
    {
      this.__responseData = responseData;
      this.__responseHeaders = responseHeaders;
      
      // The transport of the request and response is complete
      this.setState("receiving");

      // Was this a successful result?
      if (responseHeaders.status == 200)
      {
        this.setState("completed");
      }
      else
      {
        this.setState("failed");
      }
    },

    // overridden
    setRequestHeader : function(label, value) 
    {
      this.getRequestHeaders()[label] = value;
    },


    // overridden
    getResponseHeader : function(vLabel) 
    {
      // No response headers in this transport
      return null;
    },


    // overridden
    getResponseHeaders : function()
    {
      // No response headers in this transport
      return {};
    },


    // overridden
    getStatusCode : function() 
    {
      return this.__responseHeaders["status"];
    },


    // overridden
    getStatusText : function() 
    {
      // Since we always assume success, there's no need for status text.
      return this.__responseHeaders["statusText"];
    },


    // overridden
    getResponseText : function()
    {
      return this.__responseData;
    },
    
    
    // overridden : function()
    getResponseXml : function()
    {
      // If we're expecting XML data in the response...
      if (this.getResponseType() == "application/xml")
      {
        // ... then give it to 'em.
        return this.__responseData;
      }
      
      // Otherwise, there's no XML response data.
      return null;
    },


    // overridden
    getFetchedLength : function() 
    {
      // We either have complete content, or none at all.
      return 0;
    },


    // overridden
    getResponseContent : function()
    {
      var             ret;
      var             text;
      
      // If we don't yet have a response...
      if (this.getState() !== "completed")
      {
        if (qx.core.Environment.get("qx.debug"))
        {
          if (qx.core.Environment.get("qx.ioRemoteDebug")) 
          {
            this.warn("Transfer not complete, ignoring content!");
          }
        }

        // ... there's nothing useful to give 'em.
        return null;
      }

      if (qx.core.Environment.get("qx.debug"))
      {
        if (qx.core.Environment.get("qx.ioRemoteDebug")) 
        {
          this.debug("Returning content for responseType: " +
                     this.getResponseType());
        }
      }

      // What response type are we expecting?
      switch(this.getResponseType())
      {
      case "text/plain":
      case "text/html":
        if (qx.core.Environment.get("qx.debug"))
        {
          if (qx.core.Environment.get("qx.ioRemoteDebugData"))
          {
            this.debug("Response: " + this._responseContent);
          }
        }

        // It's an ordinary string. We can give it to them as is.
        ret = this._responseContent;
        return (ret === 0 ? 0 : (ret || null));

      case "application/json":
        if (qx.core.Environment.get("qx.debug"))
        {
          if (qx.core.Environment.get("qx.ioRemoteDebugData"))
          {
            this.debug("Response: " + text);
          }
        }

        try 
        {
          text = this.__responseData;
          if (text && text.length > 0)
          {
            ret = qx.util.Json.parse(text, false);
            ret = (ret === 0 ? 0 : (ret || null));
            return ret;
          }
          else
          {
            return null;
          }
        }
        catch(ex)
        {
          this.error("Could not execute json: [" + text + "]", ex);
          return "<pre>Could not execute json: \n" + text + "\n</pre>";
        }

      case "text/javascript":
        if (qx.core.Environment.get("qx.debug"))
        {
          if (qx.core.Environment.get("qx.ioRemoteDebugData"))
          {
            this.debug("Response: " + text);
          }
        }

        try 
        {
          text = this.__responseData;
          if(text && text.length > 0)
          {
            ret = window.eval(text);
            return (ret === 0 ? 0 : (ret || null));
          }
          else
          {
            return null;
          }
        } 
        catch(ex) 
        {
          this.error("Could not execute javascript: [" + text + "]", ex);
          return null;
        }

      case "application/xml":
        text = this.getResponseXml();

        if (qx.core.Environment.get("qx.debug"))
        {
          if (qx.core.Environment.get("qx.ioRemoteDebugData"))
          {
            this.debug("Response: " + text);
          }
        }

        return (text === 0 ? 0 : (text || null));

      default:
        this.warn("No valid responseType specified (" +
                  this.getResponseType() + ")!");
        return null;
      }
    }
  },


  destruct : function()
  {
    this.__request = null;
    this.__responseData = null;
    this.__resposneHeaders = null;
  },


  defer : function()
  {
    // Patch qx.io.remote.Exchange with our own send() method that supports
    // looking at the "need" for a simulated transport.
    qx.Class.patch(qx.io.remote.Exchange, rpcjs.sim.remote.MExchange);
    
    // Similarly, for qx.io.remote.Request, except it can be a simple include
    // since it's only adding a property.
    qx.Class.include(qx.io.remote.Request, rpcjs.sim.remote.MRequest);

    // Patch qx.io.remote.Rpc with our own createRequest() method that supports
    // setting the simulate property of the request.
    qx.Class.patch(qx.io.remote.Rpc, rpcjs.sim.remote.MRpc);
    
    // Register ourself with qx.io.remote.Exchange
    qx.io.remote.Exchange.registerType(rpcjs.sim.remote.Transport,
                                       "rpcjs.sim.remote.Transport");
    
    // Add ourself as the first tried transport
    qx.io.remote.Exchange.typesOrder.unshift("rpcjs.sim.remote.Transport");
  }
});
