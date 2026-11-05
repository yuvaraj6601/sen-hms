package com.hms.modules.opvisit.enums;

/**
 * Registration type for an OP visit. Drives the token-number prefix
 * (e.g. CONSULTATION → "CON", XRAY → "XRA") and daily per-type sequencing.
 */
public enum RegType {
    CONSULTATION("CON"),
    XRAY("XRA"),
    SCAN("SCA"),
    REVIEW("REV"),
    PHYSIOTHERAPY("PHY"),
    OTHERS("OTH");

    private final String tokenPrefix;

    RegType(String tokenPrefix) {
        this.tokenPrefix = tokenPrefix;
    }

    /** 3-letter prefix used to build the token number, e.g. CON290926001. */
    public String getTokenPrefix() {
        return tokenPrefix;
    }
}
