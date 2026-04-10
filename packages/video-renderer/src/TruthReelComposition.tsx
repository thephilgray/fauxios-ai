import { Composition, Sequence, Html5Audio, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface TruthReelProps {
  truthText: string;
  scriptureText: string;
  scriptureReference: string;
  imageUrl: string;
  audioUrl: string;
}

const BackgroundImage = ({ imageUrl }: { imageUrl: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow zoom from 100% to 115%
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
        filter: 'brightness(0.6)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        borderRadius: 20,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        opacity
      }}>
        <h1 style={{ fontFamily: 'sans-serif', margin: 0, paddingBottom: 20, color: '#f44336' }}>The 'Truth'</h1>
        <p style={{ fontFamily: 'sans-serif', fontSize: '42px', lineHeight: 1.4, margin: 0 }}>"{text}"</p>
      </div>
    </div>
  );
};

const Act2Verse = ({ text, reference }: { text: string, reference: string }) => {
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
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        color: '#1a1a1a',
        borderRadius: 20,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        opacity
      }}>
        <h1 style={{ fontFamily: 'serif', margin: 0, paddingBottom: 20, color: '#1976d2' }}>The Verse</h1>
        <p style={{ fontFamily: 'serif', fontSize: '46px', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>"{text}"</p>
        <p style={{ fontFamily: 'serif', fontSize: '38px', fontWeight: 'bold', margin: '30px 0 0 0', textAlign: 'right' }}>— {reference}</p>
      </div>
    </div>
  );
};

export const TruthReelMain = (props: TruthReelProps) => {
  const act1Duration = 240; // 8 seconds
  const act2Duration = 240; // 8 seconds

  return (
    <div style={{ flex: 1, backgroundColor: 'black' }}>
      <BackgroundImage imageUrl={props.imageUrl} />
      <Html5Audio src={props.audioUrl} loop={true} />
      
      <Sequence from={0} durationInFrames={act1Duration}>
        <Act1Truth text={props.truthText} />
      </Sequence>
      
      <Sequence from={act1Duration} durationInFrames={act2Duration}>
        <Act2Verse text={props.scriptureText} reference={props.scriptureReference} />
      </Sequence>
    </div>
  );
};

export const TruthReelComposition = () => {
  const totalDuration = 480; // 16 seconds

  return (
    <Composition
      id="TruthReel"
      component={TruthReelMain as React.FC<any>}
      durationInFrames={totalDuration}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        truthText: "When I won the Election, everyone said it was the best.",
        scriptureText: "Pride goes before destruction, a haughty spirit before a fall.",
        scriptureReference: "Proverbs 16:18",
        imageUrl: "https://www.remotion.dev/assets/example.jpeg",
        audioUrl: "https://fauxios-project-dev-processedimagesbucket-utnmhzxn.s3.amazonaws.com/audio/runway_track.mp3"
      }}
    />
  );
};
