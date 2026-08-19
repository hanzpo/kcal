import React from 'react';
import { Text, View } from 'react-native';

import { GhostButton } from '@/components/ui';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 bg-page px-8 dark:bg-page-dark">
          <Text className="text-[20px] font-bold text-ink dark:text-ink-inv">Something broke</Text>
          <Text className="text-center text-[13px] leading-5 text-ink-mut">
            {this.state.error.message}
          </Text>
          <View className="w-full">
            <GhostButton label="Try again" onPress={() => this.setState({ error: null })} />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}
