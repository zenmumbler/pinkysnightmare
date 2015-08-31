# Pinky's Nightmare
&copy; 2015 by Arthur Langereis ([@zenmumbler](https://twitter.com/zenmumbler))

This was my entry for the 33rd Ludum Dare Game Jam, a recurring event in which people
make a game in 2 days (Compo) or 3 days (Jam).
I went for the Jam as I needed all the time I could get and I didn't want to recreate
some 3D models I sourced from the web (The Compo requires all content to be made during
that time period by yourself).

### ‘Story’

Pinky the ghost went to sleep after a long day of chasing Pac around a maze.
But instead of a peaceful slumber he ends up in his worst nightmare.
He is stuck in the maze and the door to the ghost base is locked!
Find the 4 keys in the maze to unlock the door, but avoid the Abominations!

### Tech

* Plain Javascript and WebGL, using the glMatrix library for vec/mat math.
* Simple WebGL types evolved rather far away from initial webgl tutorial code.
* Plain and simple OBJ loader for vertexes, normals and uvs.
* Level mesh, camera placement and enemy path generation from a PNG top down level image.
* Basic circle-circle (entities) and circle-square grid collision detection and response.

### The Good

* First WebGL project that worked out quite well, 3d maze with collision detection etc.
* Atmospheric look by means of look-at cameras placed high above (like early PSOne 3D games)
  and simple fog effects + color gradients.
* Complete game with a beginning and an end. 

### The Meh

* Disorienting maze. The Pac-man maze does not lend itself well to 3rd person navigation
  (or 1st person for that matter)<br>
  The maze is color-coded from each corner to give some idea where you are but it did
  not help. A mini-map and better: a different map, would have been much better.
* Pinky does not have a directional indicator so when standing still you can't know which
  way you're facing.
* No sound. I ran out of time. Adding pac grunts, key tingling etc. with distance fading
  and some simple spooky soundscape would have contributed greatly to the atmosphere.

### Where

☞ [Play it online](http://zenmumbler.net/ld33/)<br>
☞ [View Jam Entry Page](http://ludumdare.com/compo/ludum-dare-33/?action=preview&uid=17143)
