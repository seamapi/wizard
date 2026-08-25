# Configure parameters to be partially matched (e.g. passw matches password)
# and filtered from the log file. Use this to limit dumping sensitive data.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn,
]
