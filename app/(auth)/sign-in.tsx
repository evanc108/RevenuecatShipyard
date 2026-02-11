import { Redirect } from 'expo-router';

export default function SignInRedirect() {
  return <Redirect href={{ pathname: '/(onboarding)/sign-up', params: { mode: 'signIn' } }} />;
}
