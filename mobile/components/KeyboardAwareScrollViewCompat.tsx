import { Platform, ScrollView, ScrollViewProps, NativeModules } from "react-native";
import React from "react";

let KeyboardAwareScrollView: any = null;
try {
  if (NativeModules.KeyboardController) {
    KeyboardAwareScrollView = require("react-native-keyboard-controller").KeyboardAwareScrollView;
  }
} catch {}

type Props = ScrollViewProps & {
  bottomOffset?: number;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
  children?: React.ReactNode;
};

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web" || !KeyboardAwareScrollView) {
    return (
      <ScrollView keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props}>
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
