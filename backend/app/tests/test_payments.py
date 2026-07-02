from app.services.payments import calculate_fees


def test_calculate_fees_keeps_non_negative_net_amount() -> None:
    platform_fee, processing_fee, net_amount = calculate_fees(1000)
    assert platform_fee > 0
    assert processing_fee > 0
    assert net_amount == 1000 - platform_fee - processing_fee
