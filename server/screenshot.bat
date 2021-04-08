@ECHO OFF

FOR %%I IN ("public\screens\*.png") DO (
  SET lmdate=%%~tI
  SETLOCAL EnableDelayedExpansion
  SET lmdate=!lmdate:~6,4!-!lmdate:~3,2!-!lmdate:~0,2! !lmdate:~11,2!-!lmdate:~14,2!
  MOVE "%%I" "public\screens\old\!lmdate!-%%~nxI"
  ENDLOCAL
)

::Take screenshot of primary monitor at full resolution
screenshot-cmd 0 0 1920 1080 -o public\screens\fighters.png

::ImageMagick shave off the left 478 pixels and the top 135 pixels to cleanup the image
convert -shave 478x135  public\screens\fighters.png public\screens\fighters.png

::ImageMagick remove the bottom and right borders
convert public\screens\fighters.png -gravity South  -chop  0x150  public\screens\fighters.png

::Now we have a screenshot with just the fighters. Now we have to extract the names of the fighters and put them in separate files

::Extract fighter1 name by cropping out an 800px X 40px swatch from the top of the image
convert public\screens\fighters.png -crop 800x40+60+0 public\screens\name1.png

::Remove all colors except for the red used by the font
convert public\screens\name1.png -matte ( +clone -fuzz 5600 -transparent #e3522d ) -compose DstOut -composite public\screens\name1.png

::Extract fighter1 name by cropping out an 800px X 40px swatch from the bottom of the image
convert public\screens\fighters.png -crop 800x40+200+618 public\screens\name2.png

::Remove all colors except for the red used by the font
convert public\screens\name2.png -matte ( +clone -fuzz 5600 -transparent #2798ff ) -compose DstOut -composite public\screens\name2.png

::Feed the player names into tesseract for OCR scanning.Write results to two different text files. One for each fighter
tesseract public\screens\name1.png public\fighter1Name -l salty
tesseract public\screens\name2.png public\fighter2Name -l salty

