import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(1);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(20);
