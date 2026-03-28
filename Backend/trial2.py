from trial import make_outbound_call

phone_number = "+15302203762"

if __name__ == "__main__":
    result = make_outbound_call(phone_number)
    print("Call response:", result)