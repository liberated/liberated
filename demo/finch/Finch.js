/*
 * Interface to the Finch control methods
 * 
 * Copyright (c) 2011 Derrell Lipman
 * 
 * License:
 *   LGPL: http://www.gnu.org/licenses/lgpl.html 
 *   EPL: http://www.eclipse.org/org/documents/epl-v10.php
 */

qx.Class.define("Finch",
{
  extend : qx.core.Object,
  
  construct : function()
  {
    // If we're running in the server environment, then register each of the
    // available services
    if (window.registerService)
    {
      registerService(this,
                      "reset", 
                      this.reset, 
                      []);

      registerService(this,
                      "playTone",
                      this.playTone,
                      [ "frequency", "duration" ]);

      registerService(this,
                      "getAccelerations",
                      this.getAccelerations,
                      []);

      registerService(this,
                      "getLightSensors",
                      this.getLightSensors,
                      []);

      registerService(this,
                      "getObstacleSensors",
                      this.getObstacleSensors,
                      []);

      registerService(this,
                      "getTemperature",
                      this.getTemperature,
                      []);

      registerService(this,
                      "getAllSensors",
                      this.getAllSensors,
                      []);

      registerService(this,
                      "setLED",
                      this.setLED,
                      [ "r", "g", "b" ]);

      registerService(this,
                      "setWheelPower",
                      this.setWheelPower,
                      [ "leftWheelPower", "rightWheelPower" ]);
    }
  },

  statics :
  {
    Error_Finch : 1
  },

  members :
  {
    __finch : null,

    /**
     * Get and save a new finch object, or return the existing one.
     */
    _getFinch : function()
    {
      // Get a reference to our Finch
      var finch = this.__finch;

      // Disconnect from the finch
      if (finch != null)
      {
          return finch;
      }

      // Reconnect with a new Finch object
      try
      {
        // Obtain a finch object
        this.__finch =
          new Packages.edu.cmu.ri.createlab.terk.robot.finch.Finch();

        // Indicate success 
        return this.__finch;
      }
      catch (e)
      {
        // Some unknown error. Wrap its text in our own error
        throw new JsonRpcError(this.constructor.Error_Finch,
                               "Finch: " + e.toString(), e);
      }
    },

    /**
     * Reset the Finch by disconnecting. The next request will reconnect.
     * 
     * @return 0, always.
     */
    reset : function()
    {
      // If we're connected to the finch...
      if (this.__finch != null)
      {
        // ... then disconnect from it, ...
        this.__finch.quit();

        // ... and note that we're no longer connected.
        this.__finch = null;
      }

      // Indicate success
      return 0;
    },

    /**
     * Play a tone at a specified frequency for a specified duration, on the
     * Finch's internal buzzer.
     *
     * Note that this is non-blocking, so a subsequent call before an initial
     * call has completed the specified duration will stop the initial tone and
     * begin the newly-requested one.
     *
     * @param frequency
     *   The frequency, in Hertz, of the tone to play. Middle C is about
     *   262Hz. See http://www.phy.mtu.edu/~suits/notefreqs.html for
     *   frequencies of musical notes.
     *
     * @param duration
     *   The duration, in milliseconds, for which the tone should play.
     *
     * @return
     *   0, always
     *   
     * @throws JsonRpcError
     */
    playTone : function(frequency, duration)
    {
      // Make him buzz
      this._getFinch().buzz(parseInt(frequency, 10), parseInt(duration, 10));

      // Indicate success
      return 0;
    },

    /**
     * Obtain the current accelerometer values. Acceleration values will be in
     * the range [-1.5, +1.5]. When the Finch is level, the x and y values
     * should show close to 0.0, and the z value close to +1.0
     * 
     * @return A map containing the x, y, and z accelerometer values.
     * @throws JsonRpcError
     */
    getAccelerations : function()
    {
      // Get the current acceleration values
      var accelerations = this._getFinch().getAccelerations();

      // Convert them to object format
      return(
        {
          x : accelerations[0],
          y : accelerations[1],
          z : accelerations[2]
        });
    },

    /**
     * Get the current light sensor values. Values are in the range [0, 255]
     * with higher values indicating more light being detected.
     * 
     * @return A map containing the "left" and "right" light sensor values
     * @throws JsonRpcError
     */
    getLightSensors : function()
    {
      // Get the current light sensor values
      var sensors = this._getFinch().getLightSensors();

      // Convert them to object format
      return(
        {
          left  : sensors[0],
          right : sensors[1]
        });
    },

    /**
     * Get the current obstacle sensor values. Values are boolean, with true
     * indicating that an obstacle is detected.
     * 
     * @return A map containing the left and right sensor values
     * @throws JsonRpcError
     */
    getObstacleSensors : function()
    {
      // Get the current obstacle sensor values
      var sensors = this._getFinch().getObstacleSensors();

      // Convert them to object format
      return(
        {
          left  : sensors[0],
          right : sensors[1]
        });
    },

    /**
     * Get the current temperature sensor value. The value is measured in
     * degrees Celsius.
     * 
     * @return The temperature sensor value.
     * @throws JsonRpcError
     */
    getTemperature : function()
    {
      // Get and return the current temperature sensor value
      return this._getFinch().getTemperature();
    },

    /**
     * Get the values of all sensors.
     * 
     * See the individual sensor methods for details of values.
     * 
     * @return A map containing an "accelerometer" map, a "light" map, an
     *         "obstacle" map, and a "temperature" value.
     * @throws JsonRpcError
     */
    getAllSensors : function()
    {
      var             ret = {};

      // Get a reference to our Finch
      var finch = this._getFinch();

      // Get the current acceleration values
      var accelerations = finch.getAccelerations();

      // Add the accelerometer values to the temp object, and add the temp
      // object to the return object
      ret.accelerometer =
        {
          x : accelerations[0],
          y : accelerations[1],
          z : accelerations[2]
        };

      // Get the current light sensor values
      var lightSensors = finch.getLightSensors();

      // Add the light sensor values to the temp object, and add the temp
      // object to the return object
      ret.light =
        {
          left  : lightSensors[0],
          right : lightSensors[1]
        };

      // Get the current obstacle sensor values
      var obstacleSensors = finch.getObstacleSensors();

      // Add the obstacle sensor values to the temp object, and add the temp
      // object to the return object
      ret.obstacle =
        {
          left  : obstacleSensors[0],
          right : obstacleSensors[1]
        };

      // Get the temperature sensor value and add it to the return object
      ret.temperature = finch.getTemperature();

      // Give 'em the whole kit and kaboodle!
      return ret;
    },

    /**
     * Set Finch's beak LED to a specified color. If any color value is out of
     * range, it is set to the closest extreme value of the legal range.
     * 
     * @param r
     *        The intensity of red, in the range [0, 255]
     * 
     * @param g
     *        The intensity of green, in the range [0, 255]
     * 
     * @param b
     *        The intensity of blue, in the range [0, 255]
     * 
     * @return 0, always
     * @throws JsonRpcError
     */
    setLED : function(r, g, b)
    {
      // Ensure that all intensity values are within range
      // First red...
      if (r < 0)
      {
          r = 0;
      }
      else if (r > 255)
      {
          r = 255;
      }

      // then green...
      if (g < 0)
      {
          g = 0;
      }
      else if (g > 255)
      {
          g = 255;
      }

      // and finally blue.
      if (b < 0)
      {
          b = 0;
      }
      else if (b > 255)
      {
          b = 255;
      }

      // Set the LED intensity
      this._getFinch().setLED(r, g, b);

      // Indicate success
      return 0;
    },

    /**
     * Set the power level for each wheel. Power levels range from [-255, 255]
     * with negative values reversing the direction the wheel turns.
     * 
     * @param leftPower
     *        Power level to apply to the left wheel
     * 
     * @param rightPower
     *        Power level to apply to the right wheel
     * 
     * @return 0, always
     * @throws JsonRpcError
     */
    setWheelPower : function(leftWheelPower, rightWheelPower)
    {
      var     leftPower = leftWheelPower;
      var     rightPower = rightWheelPower;

      // If either value is out of range, map it to the closest extreme legal
      // value. First the left wheel power...
      if (leftPower < -255)
      {
          leftPower = -255;
      }
      else if (leftPower > 255)
      {
          leftPower = 255;
      }

      // ... and now the right wheel power.
      if (rightPower < -255)
      {
          rightPower = -255;
      }
      else if (rightPower > 255)
      {
          rightPower = 255;
      }

      // The Finch API calls this "wheel velocity" but is implemented as wheel
      // power. We may try to implement a velocity function based on power
      // duty cycle, at some point.
      this._getFinch().setWheelVelocities(leftPower, rightPower);

      // Indicate success
      return 0;
    }
  }
});

new Finch();
