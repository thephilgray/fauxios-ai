import React from 'react';
import { Composition, Sequence, Html5Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface RevolutionReelProps {
  truthText: string;
  foundingQuoteText: string;
  foundingReference: string;
  imageUrl: string;
  audioUrl: string;
}

const BackgroundImage = ({ imageUrl }: { imageUrl: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames - 1], [1, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Img
      src={imageUrl}
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${scale})`,
        filter: 'sepia(0.3) brightness(0.7) contrast(1.1)',
      }}
    />
  );
};

const Act1Truth = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        padding: '40px',
        backgroundColor: 'rgba(25, 25, 25, 0.85)',
        color: '#e0e0e0',
        borderRadius: 5,
        boxShadow: '0 0 30px rgba(0,0,0,0.8)',
        border: '1px solid #5a4b3c',
        opacity
      }}>
        <h1 style={{ fontFamily: 'sans-serif', margin: 0, paddingBottom: 20, color: '#ff5252', textTransform: 'uppercase', letterSpacing: 2 }}>The 'Truth'</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '42px', lineHeight: 1.4, margin: 0 }}>"{text}"</p>
      </div>
    </div>
  );
};

const Act2Founding = ({ text, reference }: { text: string, reference: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '85%',
        padding: '40px',
        backgroundColor: 'rgba(244, 238, 224, 0.95)',
        backgroundImage: 'radial-gradient(#f4eee0 60%, #e3d5b8 100%)',
        color: '#2b2b2b',
        borderRadius: 5,
        boxShadow: '0 0 30px rgba(0,0,0,0.7)',
        border: '2px solid #8b7355',
        opacity
      }}>
        <h1 style={{ fontFamily: 'Georgia, serif', margin: 0, paddingBottom: 20, color: '#1a365d', textTransform: 'uppercase', letterSpacing: 2 }}>The Founding Principle</h1>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '46px', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>"{text}"</p>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '38px', fontWeight: 'bold', margin: '30px 0 0 0', textAlign: 'right', color: '#1a365d' }}>— {reference}</p>
      </div>
    </div>
  );
};

export const RevolutionReelMain: React.FC<any> = (props: RevolutionReelProps) => {
  const act1Duration = 240; 
  const act2Duration = 240; 

  return (
    <div style={{ flex: 1, backgroundColor: 'black' }}>
      <BackgroundImage imageUrl={props.imageUrl} />
      <Html5Audio src={props.audioUrl} loop={true} />
      
      <Sequence from={0} durationInFrames={act1Duration}>
        <Act1Truth text={props.truthText} />
      </Sequence>
      
      <Sequence from={act1Duration} durationInFrames={act2Duration}>
        <Act2Founding text={props.foundingQuoteText} reference={props.foundingReference} />
      </Sequence>
    </div>
  );
};

export const RevolutionReelComposition = () => {
  const totalDuration = 480; 

  return (
    <Composition
      id="RevolutionReel"
      component={RevolutionReelMain}
      durationInFrames={totalDuration}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        truthText: "They are treating me so unfairly, nobody has ever been treated this badly.",
        foundingQuoteText: "No man is allowed to be a judge in his own cause, because his interest would certainly bias his judgment.",
        foundingReference: "James Madison, Federalist No. 10",
        imageUrl: "https://www.remotion.dev/assets/example.jpeg",
        audioUrl: "https://fauxios-project-dev-processedimagesbucket-utnmhzxn.s3.amazonaws.com/audio/runway_track.mp3"
      }}
    />
  );
};
