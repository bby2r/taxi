export type AuthStackParamList = {
  PhoneLogin: undefined;
  OtpVerify: { phone: string };
  DriverLogin: undefined;
};

export type ClientTabParamList = {
  Home: undefined;
  History: undefined;
  Profile: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  OrderActive: { orderId: number };
  Stats: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  ClientApp: undefined;
  DriverApp: undefined;
};
