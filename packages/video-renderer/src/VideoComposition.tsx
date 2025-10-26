import { useRef, useEffect } from 'react';
import { Composition, Sequence, Html5Video, Html5Audio, delayRender, continueRender, useVideoConfig, Img, staticFile, useCurrentFrame, interpolate } from 'remotion';

// Define the props structure that the Remotion Lambda will receive
interface VideoProps {
  headline: string;
  voiceoverUrl: string;
  cartoonImageUrl: string; // Changed from animatedCartoonUrl
  avatarVideoUrl: string;
  avatarVideoDuration: number; // Added avatarVideoDuration
  quote: string;
  author: string;
}

// Act 1: Simple text animation of the headline
const Act1Event = ({ headline, voiceoverUrl }: { headline: string; voiceoverUrl: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div style={{ flex: 1, backgroundColor: 'black', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 60, padding: 20, textAlign: 'center' }}>
      <h1>{headline}</h1>
      <Html5Audio ref={audioRef} src={voiceoverUrl} />
    </div>
  );
};

// Act 2: Displays the static cartoon image with Ken Burns effect and overlaid headline
const Act2Reaction = ({ cartoonImageUrl, headline }: { cartoonImageUrl: string; headline: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Animate a slow zoom-in from 100% scale to 110% scale
  const scale = interpolate(frame, [0, durationInFrames - 1], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animate a slow pan from left to right
  const x = interpolate(frame, [0, durationInFrames - 1], [0, -50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Img
        src={cartoonImageUrl}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${x}px)`,
        }}
      />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '20px',
        textAlign: 'center',
        fontSize: '40px',
        fontWeight: 'bold',
        width: '80%',
      }}>
        {headline}
      </div>
    </div>
  );
};

const VideoPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  return <Html5Video ref={videoRef} src={src} style={{ width: '100%', height: '100%' }} />;
};

// Act 3: Plays the founding father avatar video and displays the quote
const Act3Reflection = ({ avatarVideoUrl, quote, author }: { avatarVideoUrl: string; quote: string; author: string }) => {
  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
      <VideoPlayer src={avatarVideoUrl} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        width: '100%',
        padding: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 40, margin: 0 }}>"{quote}"</p>
        <p style={{ fontSize: 30, fontStyle: 'italic', marginTop: 10 }}>- {author}</p>
      </div>
    </div>
  );
};

export const VideoComposition = () => {
  // Total duration can be adjusted based on the length of the generated assets
  const act1Duration = 150; // 5 seconds
  const act2Duration = 300; // 10 seconds
  const act3Duration = 450; // Default to 15 seconds
  const totalDuration = act1Duration + act2Duration + act3Duration;

  return (
    <Composition
      id="FauxiosVideo"
      component={MainSequence as React.ComponentType}
      durationInFrames={totalDuration}
      fps={30}
      width={1080}
      height={1920} // Vertical format
      // Props are passed from the renderVideo lambda
      defaultProps={{
        headline: "Default Headline",
        voiceoverUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", // Placeholder MP3
        cartoonImageUrl: "https://www.remotion.dev/assets/example.jpeg", // Placeholder JPG
        avatarVideoUrl: "https://www.remotion.dev/assets/example.mp4", // Placeholder MP4
        avatarVideoDuration: 8, // Default to 8 seconds
        quote: "Default Quote",
        author: "Default Author",
      }}
    />
  );
};

const MainSequence = ({ headline, voiceoverUrl, cartoonImageUrl, avatarVideoUrl, avatarVideoDuration, quote, author }: VideoProps) => {
  const { fps } = useVideoConfig();
  const act1Duration = 150; // 5 seconds
  const act2Duration = 300; // 10 seconds
  const act3Duration = Math.ceil(avatarVideoDuration * fps);

  return (
    <>
      <Sequence from={0 as number} durationInFrames={act1Duration as number}>
        <Act1Event headline={headline} voiceoverUrl={voiceoverUrl} />
      </Sequence>
      <Sequence from={act1Duration as number} durationInFrames={act2Duration as number}>
        <Act2Reaction cartoonImageUrl={cartoonImageUrl} headline={headline} />
      </Sequence>
      <Sequence from={(act1Duration + act2Duration) as number} durationInFrames={act3Duration as number}>
        <Act3Reflection avatarVideoUrl={avatarVideoUrl} quote={quote} author={author} />
      </Sequence>
    </>
  );
};
