import { SevnFocusScreen } from '@acme/feature-home';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('../../../example/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Sevn Focus</ThemedText>
        <ThemedText>Keep your attention anchored to what matters most.</ThemedText>
      </ThemedView>
      <ThemedView style={styles.stepContainer}>
        <SevnFocusScreen style={styles.focusCard}>
          <ThemedText>
            Pin this focus screen in the Sevn browser extension to stay present while you work.
          </ThemedText>
          <ThemedText style={styles.caption}>
            The same shared UI powers both the mobile app and the extension view.
          </ThemedText>
          <Link href="/modal">
            <Link.Trigger>
              <ThemedText type="link">Open quick actions</ThemedText>
            </Link.Trigger>
          </Link>
        </SevnFocusScreen>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  focusCard: {
    alignItems: 'flex-start',
  },
  caption: {
    fontSize: 16,
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
