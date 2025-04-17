import Janus from "janus-gateway";

export class JanusUtil {
  static roomId: number;
  static remoteFeedPlugin: any;
  static pluginHandler: any;
  static screenSources = [];
  static janusRef: Janus;

  static screenName = '***SCREEN***' + Janus.randomString(5);
  static screenSharePlugin: any;

  static setPlugin(plugin: any) {
    JanusUtil.pluginHandler = plugin;
  }

  static setJanusInstance(janus: Janus) {
    JanusUtil.janusRef = janus;
  }

  static setRoomId(roomId: number) {
    JanusUtil.roomId = roomId;
  }

static destroyRoom() {
   JanusUtil.pluginHandler.send({
      message: {
        request: 'leave',
        room: JanusUtil.roomId,
      },
      success: (response) => {
      },
      error: () => {
        console.log('Error deleting room')
      }
    })
  }

  static publishOwnFeed() {
    // Publish our stream
    JanusUtil.pluginHandler.createOffer({
      media: {
        audioRecv: false, // We're sending, not receiving
        videoRecv: false,
        audioSend: true,
        videoSend: true
      },
        success: (jsep: any) => {
          const publish = {
            request: "configure",
            audio: true,
            video: true,
            record: false,
            bitrate: 102400
          };
          JanusUtil.pluginHandler.send({ message: publish, jsep: jsep });
        },
        error: (error: any) => {
          this.publishOwnFeedWithoutCamera()
          console.error("WebRTC error:", error);
        },
      });
  }

  private static publishOwnFeedWithoutCamera() {
    JanusUtil.pluginHandler.createOffer({
      media: {
        audioSend: true,
        videoSend: false,
        videoRecv: false,
      }, // Screen sharing Publishers are sendonly
      success: (jsep) => {
        Janus.debug("Got publisher SDP!", jsep);
        const publish = {
          request: "configure",
          audio: true,
          video: false,
        };
        JanusUtil.pluginHandler.send({
          message: publish,
          jsep: jsep,
        });
      },
      error: (error) => {
        Janus.error("WebRTC error:", error);
        console.log("WebRTC error... " + error.message);
      },
    });
  }

  static toggleRemoteUserMic(userId: string, mute) {
    JanusUtil.pluginHandler.send({
      message: {
        request: "moderate",
        room: this.roomId,
        id: +userId,
        mid: "0",
        mute
      },
    });
  }

  static toggleRemoteUserCam(userId: string, mute) {
    JanusUtil.pluginHandler.send({
      message: {
        request: "moderate",
        room: this.roomId,
        id: +userId,
        mid: "1",
        mute
      },
    });
  }

  static async startScreenShare() {
      this.selectScreenSource();
  }

  static selectScreenSource() {
    this.publishScreen();
    this.screenSources = [];
  }

  static publishScreen() {
    this.janusRef.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: JanusUtil.screenName + Janus.randomString(4),
      success: (pluginHandle) => {
        JanusUtil.screenSharePlugin = pluginHandle;

        var subscribe = {
          request: "join",
          room: JanusUtil.roomId,
          ptype: "publisher",
          metadata: {isScreenShare: true},
          display: JanusUtil.screenName + Janus.randomString(4),
          quality: 0,
        };

        pluginHandle.send({
          message: subscribe,
        });
      },
      error: (error) => {
        Janus.error("  -- Error attaching plugin...", error);
        console.log("Error attaching plugin... " + error);
      },
      onmessage: (msg, jsep) => {
        Janus.debug(" ::: Got a message (publisher) :::", msg);
        var event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if (event) {
          if (event === "joined") {
            // this.myScreenId = msg["id"];
            // this.myPrivateScreenId = msg["private_id"];

              JanusUtil.screenSharePlugin.createOffer({
                media: {
                  video: 'screen',
                  audioSend: true,
                  videoRecv: false,
                }, // Screen sharing Publishers are sendonly
                success: (jsep) => {
                  Janus.debug("Got publisher SDP!", jsep);
                  var publish = {
                    request: "configure",
                    audio: true,
                    video: true,
                  };
                  JanusUtil.screenSharePlugin.send({
                    message: publish,
                    jsep: jsep,
                  });
                },
                error: (error) => {
                  Janus.error("WebRTC error:", error);
                  console.log("WebRTC error... " + error.message);
                },
              });
          }
        }
        if (jsep) {
          Janus.debug("Handling SDP as well...", jsep);
          this.screenSharePlugin.handleRemoteJsep({
            jsep: jsep,
          });
        }
      },
      onlocaltrack: (stream) => {
        Janus.debug(" ::: Got a local screen stream :::", stream);
        // this.localScreenStream = stream;
        // this.miniScreen.srcObject = stream;
        // this.miniScreen.classList.remove("hidden");

        // this.screenVideoElement = document.createElement("video");
        // this.screenVideoElement.srcObject = stream;
        // this.screenVideoElement.autoplay = true;

        // if (
        //   this.sfutest.webrtcStuff.pc.iceConnectionState !== "completed" &&
        //   this.sfutest.webrtcStuff.pc.iceConnectionState !== "connected"
        // ) {
        //   console.log("connecting local video");
        //   // show a spinner or something
        // }
        // var videoTracks = stream.getVideoTracks();
        // if (!videoTracks || videoTracks.length === 0) {
        //   // No webcam
        // }
      },
      webrtcState: (on) => {
        if (on) {
          this.screenSharePlugin.send({
            message: {
              request: "configure",
              bitrate: 0,
            },
          });
        }
      },
    });
  }

  static registerScreenUsername() {
    Janus.log("Screen sharing session created: " + JanusUtil.roomId);

    const register = {
      request: "join",
      room: JanusUtil.roomId,
      ptype: "publisher",
      display: JanusUtil.screenName + Janus.randomString(5),
      quality: 0,
    };

    JanusUtil.pluginHandler.send({
      message: register,
    });
  }

  static listenForScreenShareEnd(stream) {
    stream.getVideoTracks()[0].addEventListener("ended", () => {
      console.log("Stop button pressed in browser");
      this.endScreenShare(() => {});
    });
  }

 static endScreenShare(onSuccess) {
    // this.screenButtonBusy = true;
    const unpublish = {
      request: "unpublish",
    };
    JanusUtil.screenSharePlugin.send({
      message: unpublish,
      success: () => {
        onSuccess()
      },
    });
  }
}
