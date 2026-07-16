from skyfield.api import load
from config import TLE_URL, SATELLITE_LIMIT


ts = load.timescale()

satellites = load.tle_file(
    TLE_URL
)


def get_orbit(sat):

    points = []

    t = ts.now()


    for minute in range(0, 100, 5):

        future = ts.utc(
            t.utc_datetime().year,
            t.utc_datetime().month,
            t.utc_datetime().day,
            t.utc_datetime().hour,
            t.utc_datetime().minute + minute
        )


        geocentric = sat.at(future)

        subpoint = geocentric.subpoint()


        points.append({

            "lat":
            subpoint.latitude.degrees,

            "lon":
            subpoint.longitude.degrees

        })


    return points





def get_satellite_positions():

    t = ts.now()

    data=[]


    for sat in satellites[:SATELLITE_LIMIT]:


        geocentric = sat.at(t)

        subpoint = geocentric.subpoint()


        data.append({

            "id":
            sat.model.satnum,


            "name":
            sat.name,


            "lat":
            subpoint.latitude.degrees,


            "lon":
            subpoint.longitude.degrees,


            "alt":
            subpoint.elevation.km,


            "orbit":
            get_orbit(sat)

        })


    return data