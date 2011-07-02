// We'll need the readline class
load("readline.js");
load("Finch.js");


// Acceleration vectors
var flat = [0, 0, 0];
var forward = [0, 0, 0];
var back = [0, 0, 0];
var left = [0, 0, 0];
var right = [0, 0, 0];

// Manifest constants for directions
const FLAT = 0;
const FORW = 1;
const BACK = 2;
const LEFT = 3;
const RIGHT = 3;
  
var diffs = [];			// Difference vectors of accelerations
var minIndex = 0;
var state = FLAT;
var changed = false;


// Gain access to our finch
var finch = new Finch();

//
// Calibrate
//

// Get the standard comparison accelerations for a flat finch
print("Hold the finch flat and press return.");
StdIn.readline();
flat = finch.getAccelerations();

// Get the standard comparison accelerations for a forward-tilting finch
print("Tilt the finch forward and press return.");
StdIn.readline();
forward = finch.getAccelerations();

// Get the standard comparison accelerations for a backward-tilting finch
print("Tilt the finch backward and press return.");
StdIn.readline();
back = finch.getAccelerations();

// Get the standard comparison accelerations for a left-tilting finch
print("Tilt the finch left and press return.");
StdIn.readline();
left = finch.getAccelerations();

// Get the standard comparison accelerations for a right-tilting finch
print("Tilt the finch right and press return.");
StdIn.readline();
right = finch.getAccelerations();

print("\n\nPress any key to exit.");
while (! StdIn.isInputAvailable())
{
  // The maximum difference on either forward/back or left/right is the one
  // we'll use to compare against flat.

  // Get the current accelerometer values
  var currAccel = finch.getAccelerations();
  
  diffs[FLAT] = Math.max(Math.abs(flat.x - currAccel.x),
                         Math.abs(flat.y - currAccel.y));
  diffs[FORW] = Math.abs(forward.x - currAccel.x);
  diffs[BACK] = Math.abs(back.x - currAccel.x);
  diffs[LEFT] = Math.abs(left.y - currAccel.y);
  diffs[RIGHT] = Math.abs(right.y - currAccel.y);

  for(var i = 0; i < diffs.length; i++)
  {
    if(diffs[i] < diffs[minIndex])
    {
      minIndex = i;
    }
  }

  if(minIndex != state)
  {
    if(changed)
    {
      state = minIndex;
      finch.setWheelPower(0, 0);
      changed = false;
    }
    else
    {
      changed = true;
    }
  }
  else
  {
    switch(minIndex)
    {
    case FLAT:
      finch.setWheelPower(0, 0);
      break;
    case FORW:
      finch.setWheelPower(-255, -255);
      break;
    case BACK:
      finch.setWheelPower(255, 255);
      break;
    case LEFT:
      finch.setWheelPower(255, -255);
      break;
    case RIGHT:
      finch.setWheelPower(-255, 255);
      break;
    default:
      print("I shouldn't have come to this conclusion. " +
            "minIndex = " + minIndex);
      break;
    }
  }
}

finch.reset();
