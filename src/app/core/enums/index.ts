export enum JanusPluginEnum {
  VideoRoom = 'janus.plugin.videoroom',
  TextRoom = 'janus.plugin.textroom'
}

export enum JanusStreamEnum {
  Audio = '0',
  Video = '1'
}

export enum UserTypeEnum {
  Publisher = 'publisher',
  Subscriber = 'subscriber',
  Admin = 'admin',
  ScreenShare = 'screenshare',
}

export enum JanusEventEnum {
  Attached = 'attached',
  Joined = 'joined',
  Created = 'created',
  Destroyed = 'destroyed',
  Leaving = 'leaving',
  Unpublished = 'unpublished',
  Event = 'event',
  Talking = 'talking',
  StopedTalking = 'stopped-talking'
}
