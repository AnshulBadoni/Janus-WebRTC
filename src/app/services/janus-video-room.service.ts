import { Injectable, signal } from '@angular/core';
import Janus from 'janus-gateway';
import { JanusUtil } from '../utils';
import { JanusEventEnum, JanusPluginEnum, UserTypeEnum } from '../core/enums';
import { Subject } from 'rxjs';

const serverUrl = 'http://localhost:8088/janus';
// const serverUrl = 'http://34.57.163.85:8088/janus';

@Injectable({ providedIn: 'root' })
export class JanusVideoRoomService {
  janusRef: Janus;
  pluginRef: any;
  roomId: number = 100;
  userType = UserTypeEnum.Admin; // Default to Admin
  screenStream = signal(null);
  localTrack$: Subject<MediaStream> = new Subject<MediaStream>();
  remoteUserTrack$: Subject<Record<string, MediaStream>> = new Subject<Record<string, MediaStream>>();
  screenShareTrack$: Subject<MediaStream> = new Subject();
  remoteUserAudioTrack$: Subject<Record<string, MediaStream>> = new Subject<Record<string, MediaStream>>();
  userTalkingStatus$: Subject<{id: number, status: boolean}> = new Subject<{id: number, status: boolean}>();
  onSuccessStream: Function;

  initialJanusInstance(onSuccessStream) {
    this.onSuccessStream = onSuccessStream;

    Janus.init({
      debug: 'all',
      callback: () => {
        if (!Janus.isWebrtcSupported()) {
          alert('No WebRTC support... ');
          return;
        }

        this.janusRef = this.createJanusInstance();
      },
    });
  }

  createJanusInstance() {
    return new Janus({
      server: serverUrl,
      success: () => this.userType === UserTypeEnum.Admin ? this.attachAdminPlugin() : this.attachUserPlugin(),
      error: (error) => console.error('Janus initialization failed', error),
      destroyed: () => console.log('Janus instance destroyed'),
    });
  }

  attachAdminPlugin() {
    this.janusRef.attach({
      plugin: JanusPluginEnum.VideoRoom,
      success: (plugin: any) => {
        JanusUtil.setPlugin(plugin);
        console.log('Admin plugin attached successfully');
        plugin.send({
          message: {
            request: "create",
            room: 100,
            ptype: UserTypeEnum.Publisher,
            publishers: 10,
            audiolevel_event: true,
            audio_active_packets: 7,
            display: "User Assalom" + Janus.randomString(4),
          },
          success: (response: any) => {
            this.roomId = response.room;
            console.log(this.roomId,'roomId success', response)
            JanusUtil.setRoomId(this.roomId);
            this.joinRoom(this.roomId);
          },
          error: (error: any) => {
            console.error("error:", error);
          },
        });
      },
      error(error) {
        console.error('Error attaching plugin:', error);
      },
      onmessage: (message: any, jsep: any) => {
        if(message.videoroom === JanusEventEnum.Joined) {
          console.log('Successfully joined room!');
          this.onSuccessStream()
          JanusUtil.publishOwnFeed();
        }

        if(message.publishers) {
          this.createRemotePublisherFeed(message.publishers);
        }

        if(jsep) {
          JanusUtil.pluginHandler.handleRemoteJsep({jsep})
        }
      },
      onlocaltrack: (track, on) => {
        if (track.kind === "video") {
          let localStream = new MediaStream();
          localStream.addTrack(track);
          this.localTrack$.next(localStream);
        }
      },
    });
  }

  attachUserPlugin() {  
    this.janusRef.attach({
      plugin: JanusPluginEnum.VideoRoom,
      success: (plugin: any) => {
        JanusUtil.setPlugin(plugin);
        this.joinRoom(this.roomId);
      },
      error(error) {
        console.error('Error attaching plugin:', error);
      },  
      onmessage: (message: any, jsep: any) => {
        if(message.videoroom === JanusEventEnum.Joined) {
          console.log('Successfully joined room!');
          this.onSuccessStream();
          JanusUtil.publishOwnFeed();
        }

        if(message.videoroom === JanusEventEnum.Talking) {
          this.userTalkingStatus$.next({id: message.id, status: true})
        }else if(message.videoroom === JanusEventEnum.StopedTalking) {
          this.userTalkingStatus$.next({id: message.id, status: false})
        }

        if(message.unpublished) {
          if(message.metadata?.isScreenShare) {
            this.screenShareTrack$.next(null);
          }
        }

        if(message.publishers) {
          this.createRemotePublisherFeed(message.publishers);
        }

      },
      onlocaltrack: (track, on) => {
        if (track.kind === "video") {
          let localStream = new MediaStream();
          localStream.addTrack(track);
          this.localTrack$.next(localStream);
        }
      },
    });
  }

  createRemotePublisherFeed(publishers: any) {
    publishers.forEach((publisher: any) => {
      let remoteFeed: any = null;
      let subscription: any = [];

      this.janusRef.attach({
        plugin: "janus.plugin.videoroom",
        success: (pluginHandle: any) => {
          remoteFeed = pluginHandle;
          console.log("  -- This is a subscriber");
          publisher.streams.forEach((stream: any) => {
            if (
              stream.type === "video" &&
              Janus.webRTCAdapter.browserDetails.browser === "safari" &&
              (stream.codec === "vp9" ||
                (stream.codec === "vp8" && !Janus.safariVp8))
            ) {
              console.warn(
                "Publisher is using " +
                  stream.codec.toUpperCase +
                  ", but Safari doesn't support it: disabling video stream #" +
                  stream.mindex
              );
            } else {
              subscription.push({
                feed: publisher.id, // This is mandatory
                mid: stream.mid, // This is optional (all streams, if missing)
              });
            }
          });

          remoteFeed.send({
            message: {
              request: "join",
              room: this.roomId, // ID комнаты
              ptype: UserTypeEnum.Subscriber,
              streams: subscription,
              audiolevel_event: true, // 🔥 Enable audio level detection
              audio_active_packets: 7, // How quickly it detects speech
            },
          });

        },
        onmessage: (message, jsep) => {
          if(jsep) {
            remoteFeed.createAnswer({
              jsep: jsep,
              tracks: [{ type: "data" }],
              media: { audio: true, video: false },
              success: (jsepAnswer: any) => {
                Janus.debug("Got SDP!", jsep);
                remoteFeed.send({
                  message: { request: "start", room: this.roomId },
                  jsep: jsepAnswer,
                });
              },
              error: (error: any) => {
                Janus.error("WebRTC error:", error);
                alert("WebRTC error... " + error.message);
              },
            });
          }
        },
        onremotetrack: (track, mid, on, metadata) => {
          console.log("  -- Remote track:", track, mid, on, metadata);

          if (track.kind === "video") {
            let remoteStream = new MediaStream();
            remoteStream.addTrack(track);

            if(publisher.metadata?.isScreenShare) {
              this.screenShareTrack$.next(remoteStream)
            }else {
              this.remoteUserTrack$.next({[publisher.id]: remoteStream});
            }
          } else if(track.kind === 'audio') {
            let remoteStream = new MediaStream();
            remoteStream.addTrack(track);

            this.remoteUserAudioTrack$.next({[publisher.id]: remoteStream})
          }
        },
        error: function (error: any) {
          console.error("  -- Error attaching plugin...", error);
        },
    })
    })
  }

  joinRoom(roomId: number) {
    console.log('Joining room:', roomId);
    JanusUtil.pluginHandler.send({
      message: {
        request: 'join',
        room: roomId,
        ptype: UserTypeEnum.Publisher,
        audiolevel_event: true,
        audio_active_packets: 7,
        display: 'AngularUser' + Janus.randomString(4),
      },
    });
  }
}
