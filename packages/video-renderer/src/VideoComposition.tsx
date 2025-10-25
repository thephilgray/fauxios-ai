import { useRef, useEffect } from 'react';
import { Composition, Sequence, Html5Video, Html5Audio, delayRender, continueRender, useVideoConfig } from 'remotion'; // Added imports

// Define the props structure that the Remotion Lambda will receive
interface VideoProps {
  headline: string;
  voiceoverUrl: string;
  animatedCartoonUrl: string;
  avatarVideoUrl: string;
  quote: string;
  author: string;
}

// Act 1: Simple text animation of the headline
const Act1Event = ({ headline, voiceoverUrl }: { headline: string; voiceoverUrl: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const handle = delayRender();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onLoadedMetadata = () => {
      continueRender(handle);
    };

    const onError = (e: Event) => {
      console.error("Audio loading error:", e);
      // Optionally, continue render even on error if you want to show a fallback
      continueRender(handle);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("error", onError);
    };
  }, [handle, voiceoverUrl]);

  return (
    <div style={{ flex: 1, backgroundColor: 'black', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 60, padding: 20, textAlign: 'center' }}>
      <h1>{headline}</h1>
      <Html5Audio ref={audioRef} src={voiceoverUrl} />
    </div>
  );
};

// Act 2: Plays the animated cartoon video
const Act2Reaction = ({ animatedCartoonUrl }: { animatedCartoonUrl: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handle = delayRender();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onLoadedMetadata = () => {
      continueRender(handle);
    };

    const onError = (e: Event) => {
      console.error("Video loading error:", e);
      continueRender(handle); // Continue render even on error to prevent hanging
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [handle, animatedCartoonUrl]);

  return <Html5Video ref={videoRef} src={animatedCartoonUrl} style={{ width: '100%', height: '100%' }} />;
};

// Act 3: Plays the founding father avatar video and displays the quote
const Act3Reflection = ({ avatarVideoUrl, quote, author }: { avatarVideoUrl: string; quote: string; author: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handle = delayRender();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const onLoadedMetadata = () => {
      continueRender(handle);
    };

    const onError = (e: Event) => {
      console.error("Video loading error:", e);
      continueRender(handle); // Continue render even on error to prevent hanging
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onError);
    };
  }, [handle, avatarVideoUrl]);

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
      <Html5Video ref={videoRef} src={avatarVideoUrl} style={{ width: '100%', height: '100%' }} />
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
  const act3Duration = 450; // 15 seconds
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
        animatedCartoonUrl: "https://www.remotion.dev/assets/example.mp4", // Placeholder MP4
        avatarVideoUrl: "https://www.remotion.dev/assets/example.mp4", // Placeholder MP4
        quote: "Default Quote",
        author: "Default Author",
      }}
    />
  );
};

const MainSequence = ({ headline, voiceoverUrl, animatedCartoonUrl, avatarVideoUrl, quote, author }: VideoProps) => {
  const act1Duration = 150; // 5 seconds
  const act2Duration = 300; // 10 seconds
  const act3Duration = 450; // 15 seconds

  return (
    <>
      <Sequence from={0} durationInFrames={act1Duration}>
        <Act1Event headline={headline} voiceoverUrl={voiceoverUrl} />
      </Sequence>
      <Sequence from={act1Duration} durationInFrames={act2Duration}>
        <Act2Reaction animatedCartoonUrl={animatedCartoonUrl} />
      </Sequence>
      <Sequence from={act1Duration + act2Duration} durationInFrames={act3Duration}>
        <Act3Reflection avatarVideoUrl={avatarVideoUrl} quote={quote} author={author} />
      </Sequence>
    </>
  );
};
