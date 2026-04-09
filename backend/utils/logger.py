import logging
import sys

_logger = logging.getLogger("ai_sales_agent")
if not _logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    _logger.addHandler(_handler)
    _logger.setLevel(logging.INFO)


def get_logger(name: str | None = None) -> logging.Logger:
    if name:
        return logging.getLogger(f"ai_sales_agent.{name}")
    return _logger
