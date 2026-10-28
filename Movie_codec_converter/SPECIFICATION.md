# Movie Codec Converter

## About

This project is a video/movie codec converter, because of the H.264, H.265 and AAC isn't on linux. I want to convert those .mp4 files to a .mov files. Because of that it is for linux only. The programming language is something that you recommend! (Even Bash is fine!) Something that you should know is that I use Fedora 44, but if it's possible it should be a multiple UNIX based converter. If it's possible, try to do it with GUI, but it's not necessary.

## Requirements

-It should be able to convert from a H.264, H.265 and AAC codec video to a DNxHR / MOV file.
-It should be able to automatically do it with multiple file.
-It should be able to write those to a folder with a custom name, to a custom location.

## Tips

For this project I give you how I got this idea. So in the dnf package manager you can use the ffmpeg package to convert those. I used this command to convert it! Of course you can modify it or go with a different approach/idea.
`ffmpeg -i bemenet.mp4 -c:v dnxhd -profile:v dnxhr_hq -c:a pcm_s16le kimenet.mov`
