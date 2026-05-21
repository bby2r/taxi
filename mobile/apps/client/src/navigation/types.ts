export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
};

export type ClientTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  NameSetup: undefined;
  ClientApp: undefined;
};
